import type { Namespace, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents, RoomState } from '@sketch-catch/shared';
import { SERVER_EVENT } from '@sketch-catch/shared';
import { getRoomState, saveRoomState } from '../../services/rooms.service.js';
import { redis, setPresence, setUserRoom, clearUserRoom } from '../../db/redis.js';
import { broadcastPresenceUpdate } from '../presence.namespace.js';
import { prisma } from '../../db/prisma.js';
import { startRound, initTurnSchedule, handlePlayerLeft } from './game.js';
import { startMode2, handleMode2PlayerLeft } from './mode2.js';

type GameNamespace = Namespace<ClientEvents, ServerEvents>;
type GameSocket = Socket<ClientEvents, ServerEvents, Record<string, never>, { userId: string }>;
type FetchableSocket = { id: string; data: { userId?: string } };
type SocketFetcher = {
  in: (roomName: string) => { fetchSockets: () => Promise<FetchableSocket[]> };
};

function canFetchSockets(game: GameNamespace): game is GameNamespace & SocketFetcher {
  return typeof (game as Partial<SocketFetcher>).in === 'function';
}

// D-08: 게임 진행 중 상태 판정 — handleRoomJoin(재입장 거부)과 handleRoomLeave(퇴장 라우팅)가 공유
function isGameInProgressStatus(status: RoomState['status']): boolean {
  return (
    status === 'MODE1_ROUND_START' ||
    status === 'MODE1_ROUND_END' ||
    status === 'MODE2_PROMPT_PHASE' ||
    status === 'MODE2_DRAW_PHASE' ||
    status === 'MODE2_ANSWER_PHASE' ||
    status === 'MODE2_REVIEW'
  );
}

async function hasActiveUserSocketInRoom(
  game: GameNamespace,
  roomName: string,
  userId: string,
  leavingSocketId: string,
): Promise<boolean> {
  if (!canFetchSockets(game)) return false;

  const sockets = await game.in(roomName).fetchSockets();
  return sockets.some((s) => s.id !== leavingSocketId && s.data.userId === userId);
}

export async function handleRoomJoin(
  game: GameNamespace,
  socket: GameSocket,
  code: string,
): Promise<void> {
  const userId = socket.data.userId;
  const state = await getRoomState(code);
  if (!state) {
    socket.emit(SERVER_EVENT.ERROR, { code: 'ROOM_NOT_FOUND', message: '방을 찾을 수 없습니다. 코드를 다시 확인하세요.' });
    return;
  }

  const existingPlayer = state.players.find((p) => p.id === userId);
  if (existingPlayer) {
    // Pitfall 5: 게임 진행 중 이미 이탈(left=true)한 유저의 재입장은 거부 — 서버가 진실의 출처
    if (existingPlayer.left && isGameInProgressStatus(state.status)) {
      socket.emit(SERVER_EVENT.ERROR, { code: 'ALREADY_LEFT', message: '이미 게임에서 퇴장한 방입니다.' });
      return;
    }
    // 재접속: connected 복원
    existingPlayer.connected = true;
  } else {
    // 인원 초과 검사
    if (state.players.length >= state.config.playerCountMax) {
      socket.emit(SERVER_EVENT.ERROR, { code: 'ROOM_FULL', message: '방이 가득 찼습니다.' });
      return;
    }

    // 사용 중인 slot 번호를 제외한 최소 slot 번호 계산
    const usedSlots = new Set(state.players.map((p) => p.slot));
    let slot = 0;
    while (usedSlots.has(slot)) slot++;

    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { nickname: true, characterId: true, friendCode: true },
    });

    state.players.push({
      id: userId,
      nickname: userRecord?.nickname ?? '',
      friendCode: userRecord?.friendCode ?? '',
      characterId: userRecord?.characterId ?? '',
      slot,
      isHost: userId === state.hostId,
      isReady: false,
      connected: true,
    });
  }

  await socket.join(`room:${code}`);
  await saveRoomState(state);

  const roomName = `room:${code}`;
  game.to(roomName).emit(SERVER_EVENT.ROOM_STATE, state);

  const player = state.players.find((p) => p.id === userId)!;
  game.to(roomName).emit(SERVER_EVENT.ROOM_PLAYER_JOIN, { player });

  const presenceStatus = state.status === 'LOBBY' ? 'IN_LOBBY' : 'IN_GAME';
  await setPresence(userId, presenceStatus);
  broadcastPresenceUpdate(userId, presenceStatus);
  await setUserRoom(userId, code);
  console.log(`[room:join] presence set to ${presenceStatus} for`, userId);
}

export async function handleRoomReady(
  game: GameNamespace,
  socket: GameSocket,
  ready: boolean,
): Promise<void> {
  const userId = socket.data.userId;

  // socket.rooms에서 방 이름 찾기
  const roomName = Array.from(socket.rooms).find((r) => r.startsWith('room:'));
  if (!roomName) return;

  const code = roomName.replace('room:', '');
  const state = await getRoomState(code);
  if (!state) return;

  const player = state.players.find((p) => p.id === userId);
  if (!player) return;

  player.isReady = ready;
  // allReady는 서버에서만 계산 — 클라이언트 단독 계산 금지 (보안 원칙)
  // 방장은 준비 버튼이 없으므로 allReady 계산에서 제외 (LBBY-02)
  const nonHostPlayers = state.players.filter((p) => !p.isHost);
  state.allReady = nonHostPlayers.length > 0 && nonHostPlayers.every((p) => p.isReady);
  console.log('[ready] players:', state.players.map(p => ({ id: p.id, isHost: p.isHost, isReady: p.isReady })));
  console.log('[ready] nonHostPlayers:', nonHostPlayers.map(p => ({ id: p.id, isReady: p.isReady })));
  console.log('[ready] allReady:', state.allReady);

  await saveRoomState(state);
  game.to(roomName).emit(SERVER_EVENT.ROOM_STATE, state);
}

export async function handleRoomStart(
  game: GameNamespace,
  socket: GameSocket,
): Promise<void> {
  const userId = socket.data.userId;

  const roomName = Array.from(socket.rooms).find((r) => r.startsWith('room:'));
  if (!roomName) return;

  const code = roomName.replace('room:', '');
  const state = await getRoomState(code);
  if (!state) return;

  // 비방장 시작 요청 거부 — 보안 원칙
  if (state.hostId !== userId) {
    socket.emit(SERVER_EVENT.ERROR, { code: 'FORBIDDEN', message: '방장만 시작할 수 있습니다.' });
    return;
  }

  if (!state.allReady) {
    socket.emit(SERVER_EVENT.ERROR, { code: 'NOT_ALL_READY', message: '모두 준비 완료 후 시작 가능합니다.' });
    return;
  }

  // Pitfall 4: 모드 2는 시트 로테이션 상태 머신(startMode2)으로 분기 — initTurnSchedule(모드1 전용) 미호출
  if (state.mode === 2) {
    state.startedAt = Date.now();
    await saveRoomState(state);
    const active = state.players.filter((p) => p.connected);
    await Promise.all(active.map((p) => setPresence(p.id, 'IN_GAME')));
    active.forEach((p) => broadcastPresenceUpdate(p.id, 'IN_GAME'));
    await startMode2(game, code);
    return;
  }

  state.startedAt = Date.now();
  state.status = 'MODE1_ROUND_START';
  initTurnSchedule(state);
  await saveRoomState(state);
  game.to(roomName).emit(SERVER_EVENT.ROOM_STATE, state);

  const activePlayers = state.players.filter((p) => p.connected);
  await Promise.all(activePlayers.map((p) => setPresence(p.id, 'IN_GAME')));
  activePlayers.forEach((p) => broadcastPresenceUpdate(p.id, 'IN_GAME'));

  await startRound(game, code, 0);
}

export async function handleRoomLeave(
  game: GameNamespace,
  socket: GameSocket,
): Promise<void> {
  const userId = socket.data.userId;
  const rooms = Array.from(socket.rooms).filter((r) => r.startsWith('room:'));
  let hasActiveRoomSocket = false;

  for (const roomName of rooms) {
    const code = roomName.replace('room:', '');
    const state = await getRoomState(code);
    if (!state) continue;

    socket.leave(roomName);
    if (await hasActiveUserSocketInRoom(game, roomName, userId, socket.id)) {
      hasActiveRoomSocket = true;
      continue;
    }

    const isGameInProgress = isGameInProgressStatus(state.status);

    if (isGameInProgress) {
      // 게임 중 퇴장: 플레이어 제거 대신 left 마킹 후 모드별 후속 처리로 라우팅 (D-08)
      if (state.mode === 2) {
        await handleMode2PlayerLeft(game, code, userId);
      } else {
        await handlePlayerLeft(game, code, userId);
      }
    } else {
      // 로비/시상식: 기존 퇴장 처리
      state.players = state.players.filter((p) => p.id !== userId);

      if (state.players.length === 0) {
        await redis.del(`room:${code}:state`);
        continue;
      }

      // LBBY-03: 방장이 나간 경우 slot 최소 참가자 승계
      if (state.hostId === userId) {
        const next = state.players.sort((a, b) => a.slot - b.slot)[0]!;
        state.hostId = next.id;
        next.isHost = true;
      }

      await saveRoomState(state);
      game.to(roomName).emit(SERVER_EVENT.ROOM_STATE, state);
      game.to(roomName).emit(SERVER_EVENT.ROOM_PLAYER_LEAVE, { userId });
    }
  }

  if (hasActiveRoomSocket) return;

  await clearUserRoom(userId);
  await setPresence(userId, 'ONLINE');
  broadcastPresenceUpdate(userId, 'ONLINE');
}
