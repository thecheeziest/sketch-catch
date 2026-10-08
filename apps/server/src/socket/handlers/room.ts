import type { Namespace, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents, RoomState } from '@sketch-catch/shared';
import { randomUUID } from 'node:crypto';
import { MODE2_PLAYER_MIN, ROOM_PLAYER_MIN, SERVER_EVENT } from '@sketch-catch/shared';
import { getRoomState, saveRoomState, withRoomLock } from '../../services/rooms.service.js';
import { computeAllReady, ensureHost } from '../../services/roomRules.js';
import { setPresence, setUserRoom, clearUserRoom, getUserRoom } from '../../db/redis.js';
import { broadcastPresenceUpdate } from '../presence.namespace.js';
import { prisma } from '../../db/prisma.js';
import { startRound, initTurnSchedule, handlePlayerLeft, resendCurrentRound } from './game.js';
import { startMode2, handleMode2PlayerLeft, isMode2Active, resendCurrentStep } from './mode2.js';
import { destroyRoom, finishAward } from './award.js';

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
  return sockets.some(s => s.id !== leavingSocketId && s.data.userId === userId);
}

type JoinResult =
  | { ok: true; state: RoomState }
  | { ok: false; code: 'ROOM_NOT_FOUND' | 'ALREADY_LEFT' | 'ROOM_FULL' | 'GAME_IN_PROGRESS'; message: string };

export async function handleRoomJoin(game: GameNamespace, socket: GameSocket, code: string): Promise<void> {
  const userId = socket.data.userId;

  // 동시 입장 시 slot 번호가 겹치는 read-modify-write 레이스를 막기 위해 방 단위 락으로 감싼다.
  const result: JoinResult = await withRoomLock(code, async () => {
    const state = await getRoomState(code);
    if (!state) {
      return { ok: false, code: 'ROOM_NOT_FOUND', message: '방을 찾을 수 없습니다. 코드를 다시 확인하세요.' };
    }

    const existingPlayer = state.players.find(p => p.id === userId);
    if (existingPlayer) {
      // Pitfall 5: 게임 진행 중 이미 이탈(left=true)한 유저의 재입장은 거부 — 서버가 진실의 출처
      if (existingPlayer.left && isGameInProgressStatus(state.status)) {
        return { ok: false, code: 'ALREADY_LEFT', message: '이미 게임에서 퇴장한 방입니다.' };
      }
      // 재접속: connected 복원
      existingPlayer.connected = true;
    } else {
      // 신규 유저는 대기실에서만 입장 가능 — 진행 중·시상식 중인 게임에 끼어들면 출제 순서에 없는 유저가 생겨 게임이 멈춘다
      if (state.status !== 'LOBBY') {
        return { ok: false, code: 'GAME_IN_PROGRESS', message: '이미 게임이 진행 중인 방이에요.' };
      }
      // 인원 초과 검사
      if (state.players.length >= state.config.playerCountMax) {
        return { ok: false, code: 'ROOM_FULL', message: '방이 가득 찼습니다.' };
      }

      // 사용 중인 slot 번호를 제외한 최소 slot 번호 계산
      const usedSlots = new Set(state.players.map(p => p.slot));
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

    // 미준비 유저가 들어오면 allReady가 풀려야 한다
    state.allReady = computeAllReady(state);
    await saveRoomState(state);
    return { ok: true, state };
  });

  if (!result.ok) {
    socket.emit(SERVER_EVENT.ERROR, { code: result.code, message: result.message });
    return;
  }

  const { state } = result;
  await socket.join(`room:${code}`);

  const roomName = `room:${code}`;
  game.to(roomName).emit(SERVER_EVENT.ROOM_STATE, state);

  const player = state.players.find(p => p.id === userId)!;
  game.to(roomName).emit(SERVER_EVENT.ROOM_PLAYER_JOIN, { player });

  // 진행 중인 모드2 방에 (재)입장 시 현재 스텝을 이 소켓에만 재전송 — 화면 전환 레이스로
  // 첫 mode2:step을 놓쳐 까만 화면이 지속되는 문제 방지
  if (isMode2Active(state.status)) {
    resendCurrentStep(socket, state);
  }
  // 모드1도 동일 — 진행 중 라운드를 이 소켓에만 재전송 (첫 round:start 유실로 화면이 멈추던 문제)
  resendCurrentRound(socket, state, userId);

  // 시상식에서 [한번 더!]를 눌러 대기실로 온 유저는 대기실 상태로 표시
  const isInLobby = state.status === 'LOBBY' || (state.status === 'AWARD' && !player.inAward);
  const presenceStatus = isInLobby ? 'IN_LOBBY' : 'IN_GAME';
  await setPresence(userId, presenceStatus);
  broadcastPresenceUpdate(userId, presenceStatus);
  await setUserRoom(userId, code);
  console.log(`[room:join] presence set to ${presenceStatus} for`, userId);
}

export async function handleRoomReady(game: GameNamespace, socket: GameSocket, ready: boolean): Promise<void> {
  const userId = socket.data.userId;

  // socket.rooms에서 방 이름 찾기
  const roomName = Array.from(socket.rooms).find(r => r.startsWith('room:'));
  if (!roomName) return;

  const code = roomName.replace('room:', '');
  const state = await getRoomState(code);
  // 준비 상태는 대기실에서만 의미가 있다 (시상식 중 복귀한 유저는 대기실 전환 후 준비)
  if (!state || state.status !== 'LOBBY') return;

  const player = state.players.find(p => p.id === userId);
  if (!player) return;

  player.isReady = ready;
  // allReady는 서버에서만 계산 — 클라이언트 단독 계산 금지 (보안 원칙)
  state.allReady = computeAllReady(state);

  await saveRoomState(state);
  game.to(roomName).emit(SERVER_EVENT.ROOM_STATE, state);
}

export async function handleRoomStart(game: GameNamespace, socket: GameSocket): Promise<void> {
  const userId = socket.data.userId;

  const roomName = Array.from(socket.rooms).find(r => r.startsWith('room:'));
  if (!roomName) return;

  const code = roomName.replace('room:', '');
  const state = await getRoomState(code);
  if (!state) return;

  // 비방장 시작 요청 거부 — 보안 원칙
  if (state.hostId !== userId) {
    socket.emit(SERVER_EVENT.ERROR, { code: 'FORBIDDEN', message: '방장만 시작할 수 있습니다.' });
    return;
  }

  // 대기실에서만 시작 가능 — 진행 중·시상식 중 재시작으로 끝난 게임이 이어지던 문제 방지
  if (state.status !== 'LOBBY') {
    socket.emit(SERVER_EVENT.ERROR, { code: 'GAME_IN_PROGRESS', message: '이미 게임이 진행 중입니다.' });
    return;
  }

  // 저장된 값이 아니라 현재 참가자 기준으로 다시 계산 — 미준비 유저 입장 직후 시작 방지
  if (!computeAllReady(state)) {
    socket.emit(SERVER_EVENT.ERROR, { code: 'NOT_ALL_READY', message: '모두 준비 완료 후 시작 가능합니다.' });
    return;
  }

  // 모드별 최소 인원 미달이면 시작 거부 — 인원 부족 상태로 시작되면 출제 순서가 꼬여 게임이 멈춘다
  const minPlayers = state.mode === 2 ? MODE2_PLAYER_MIN : ROOM_PLAYER_MIN;
  if (state.players.filter(p => p.connected).length < minPlayers) {
    socket.emit(SERVER_EVENT.ERROR, {
      code: 'INSUFFICIENT_PLAYERS',
      message: `최소 ${minPlayers}명이 모여야 시작할 수 있어요.`,
    });
    return;
  }

  // 게임 1판의 식별자 발급 — 이후 타이머·이벤트는 이 값으로 지난 게임과 구분된다
  state.gameId = randomUUID();
  state.startedAt = Date.now();
  state.scoreboard = {};
  state.allReady = false;
  const activePlayers = state.players.filter(p => p.connected);

  // Pitfall 4: 모드 2는 시트 로테이션 상태 머신(startMode2)으로 분기 — initTurnSchedule(모드1 전용) 미호출
  if (state.mode === 2) {
    await saveRoomState(state);
    await Promise.all(activePlayers.map(p => setPresence(p.id, 'IN_GAME')));
    activePlayers.forEach(p => broadcastPresenceUpdate(p.id, 'IN_GAME'));
    await startMode2(game, code);
    return;
  }

  // status는 LOBBY로 둔 채 저장 — startRound가 status와 current를 한 번에 바꾸고 room:state를 보낸다
  initTurnSchedule(state);
  await saveRoomState(state);

  const started = await startRound(game, code, 0);
  if (!started) return;

  await Promise.all(activePlayers.map(p => setPresence(p.id, 'IN_GAME')));
  activePlayers.forEach(p => broadcastPresenceUpdate(p.id, 'IN_GAME'));
}

export async function handleRoomLeave(
  game: GameNamespace,
  socket: Pick<GameSocket, 'id' | 'data' | 'rooms' | 'leave'>,
  capturedCodes?: string[],
): Promise<void> {
  const userId = socket.data.userId;
  const rooms = capturedCodes
    ? capturedCodes.map(code => `room:${code}`)
    : Array.from(socket.rooms).filter(r => r.startsWith('room:'));
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
      continue;
    }

    // 로비/시상식: 즉시 제거
    const departed = state.players.filter(p => p.id === userId);
    state.players = state.players.filter(p => p.id !== userId);

    if (state.players.every(p => p.left)) {
      await destroyRoom(code);
      continue;
    }

    ensureHost(state, departed);
    state.allReady = computeAllReady(state);
    await saveRoomState(state);

    // 시상식에 남은 유저가 더 없으면 만료를 기다리지 않고 대기실로 전환 (finishAward가 room:state 전송)
    if (state.status === 'AWARD' && !state.players.some(p => p.inAward)) {
      game.to(roomName).emit(SERVER_EVENT.ROOM_PLAYER_LEAVE, { userId });
      await finishAward(game, code);
      continue;
    }
    game.to(roomName).emit(SERVER_EVENT.ROOM_STATE, state);
    game.to(roomName).emit(SERVER_EVENT.ROOM_PLAYER_LEAVE, { userId });
  }

  if (hasActiveRoomSocket) return;

  // 이전 방의 지연된 disconnect 정리가 새 방의 참가 상태를 지우지 않게 한다.
  const currentCode = await getUserRoom(userId);
  if (currentCode && !rooms.includes(`room:${currentCode}`)) return;

  await clearUserRoom(userId);
  await setPresence(userId, 'ONLINE');
  broadcastPresenceUpdate(userId, 'ONLINE');
}
