import type { Namespace, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents } from '@sketch-catch/shared';
import { SERVER_EVENT } from '@sketch-catch/shared';
import { getRoomState, saveRoomState } from '../../services/rooms.service.js';
import { redis, setPresence } from '../../db/redis.js';
import { prisma } from '../../db/prisma.js';

type GameNamespace = Namespace<ClientEvents, ServerEvents>;
type GameSocket = Socket<ClientEvents, ServerEvents, Record<string, never>, { userId: string }>;

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

  // D-15: 대기실 입장 시 presence IN_GAME으로 갱신
  await setPresence(userId, 'IN_GAME');
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
  state.allReady = state.players.length > 0 && state.players.every((p) => p.isReady);

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

  // Phase 4: startedAt 세팅 + broadcast (상태 전이는 Phase 5)
  state.startedAt = Date.now();
  await saveRoomState(state);
  game.to(roomName).emit(SERVER_EVENT.ROOM_STATE, state);
}

export async function handleRoomLeave(
  game: GameNamespace,
  socket: GameSocket,
): Promise<void> {
  const userId = socket.data.userId;
  const rooms = Array.from(socket.rooms).filter((r) => r.startsWith('room:'));

  for (const roomName of rooms) {
    const code = roomName.replace('room:', '');
    const state = await getRoomState(code);
    if (!state) continue;

    state.players = state.players.filter((p) => p.id !== userId);
    socket.leave(roomName);

    if (state.players.length === 0) {
      await redis.del(`room:${code}:state`);
      continue;
    }

    // LBBY-03: 방장이 나간 경우 slot 최소 참가자 승계
    // players.length > 0 이 위에서 보장됨 (players.length === 0이면 continue로 탈출)
    if (state.hostId === userId) {
      const next = state.players.sort((a, b) => a.slot - b.slot)[0]!;
      state.hostId = next.id;
      next.isHost = true;
    }

    await saveRoomState(state);
    game.to(roomName).emit(SERVER_EVENT.ROOM_STATE, state);
    game.to(roomName).emit(SERVER_EVENT.ROOM_PLAYER_LEAVE, { userId });
  }

  // D-15: 퇴장 시 presence ONLINE으로 복원
  await setPresence(userId, 'ONLINE');
}
