import type { Namespace } from 'socket.io';
import type { ClientEvents, ServerEvents, RoomState } from '@sketch-catch/shared';
import { SERVER_EVENT } from '@sketch-catch/shared';
import { getRoomState, saveRoomState } from '../../services/rooms.service.js';
import { clearRoomTimers } from '../../services/roomTimers.js';
import { clearRoomChat } from '../../services/chatStore.js';
import { clearRoomStrokes } from '../../services/strokeStore.js';
import { ensureHost, resetToLobby } from '../../services/roomRules.js';
import { redis, setPresence } from '../../db/redis.js';
import { broadcastPresenceUpdate } from '../presence.namespace.js';

type GameNamespace = Namespace<ClientEvents, ServerEvents>;

// 방의 Redis 상태와 메모리 런타임(타이머·채팅 저장소)을 함께 정리
export async function destroyRoom(code: string): Promise<void> {
  clearRoomTimers(code);
  clearRoomChat(code);
  clearRoomStrokes(code);
  await redis.del(`room:${code}:state`, `room:${code}:password`);
}

/**
 * 시상식 시작 — 호출 측이 status=AWARD로 바꾼 state를 받아 시상식 정보를 채우고 저장한다.
 * 남아 있는 유저는 전원 inAward=true. [한번 더!]를 누르면 대기실로, 선택 전까지 시상식 유지.
 */
export async function beginAward(_game: GameNamespace, state: RoomState): Promise<void> {
  delete state.awardEndsAt;
  state.allReady = false;
  for (const p of state.players) {
    p.inAward = !p.left;
    p.isReady = false;
  }
  // 지난 시상식에서 계속 머물던 유저도 이번 시상식 명단에 합친다 (자리는 비어 있는 slot으로)
  const usedSlots = new Set(state.players.map(p => p.slot));
  for (const viewer of state.awardViewers ?? []) {
    if (viewer.left || state.players.some(p => p.id === viewer.id)) continue;
    let slot = 0;
    while (usedSlots.has(slot)) slot++;
    usedSlots.add(slot);
    state.players.push({ ...viewer, slot, isHost: false, isReady: false, inAward: true });
  }
  delete state.awardViewers;
  await saveRoomState(state);

  // 시상식에 머무는 유저는 다른 방의 초대를 받을 수 있어야 한다 (초대는 IN_LOBBY·IN_GAME 유저를 거부)
  await Promise.all(
    state.players
      .filter(p => p.inAward)
      .map(async p => {
        await setPresence(p.id, 'ONLINE');
        broadcastPresenceUpdate(p.id, 'ONLINE');
      }),
  );
}

/**
 * 시상식에서 첫 재참여 시 대기실을 연다.
 * 미선택 참가자는 inAward를 유지해 다음 게임 참가 명단에서 제외한다.
 */
export async function finishAward(game: GameNamespace, code: string, expectedGameId?: string): Promise<void> {
  const state = await getRoomState(code);
  if (!state || state.status !== 'AWARD') return;
  if (expectedGameId !== undefined && state.gameId !== expectedGameId) return;

  clearRoomTimers(code);

  const removed = state.players.filter(p => p.left);
  const remaining = state.players.filter(p => !p.left);
  // 방장이 시상식에 남아 있으면 방장은 그대로다 — 나가기를 누른 경우에만 가장 먼저 대기실로 온 유저가 승계한다
  const hostStays = remaining.some(p => p.id === state.hostId);

  if (remaining.length === 0) {
    await destroyRoom(code);
    return;
  }

  state.players = remaining;
  const viewers = new Set(remaining.filter(p => p.inAward).map(p => p.id));
  resetToLobby(state);
  for (const p of remaining) p.inAward = viewers.has(p.id);
  if (!hostStays) ensureHost(state, removed);
  await saveRoomState(state);

  const roomName = `room:${code}`;
  game.to(roomName).emit(SERVER_EVENT.ROOM_STATE, state);
  for (const p of removed) game.to(roomName).emit(SERVER_EVENT.ROOM_PLAYER_LEAVE, { userId: p.id });
}

// 시상식에서 [한번 더!] — 선택한 유저만 대기실로 복귀, 다른 유저는 시상식 유지
// 소켓이 방에서 빠져 있어도(재연결 등) 클라이언트가 보낸 방 코드로 처리하고, 어떤 경우에도 응답을 보낸다
export async function handleRematch(
  game: GameNamespace,
  socket: {
    rooms: Set<string>;
    data: { userId: string };
    join: (room: string) => void | Promise<void>;
    emit: (event: 'error', payload: { code: string; message: string }) => void;
  },
  requestedCode?: string,
): Promise<void> {
  const joinedRoom = Array.from(socket.rooms).find(r => r.startsWith('room:'));
  const code = requestedCode ?? joinedRoom?.replace('room:', '');
  if (!code) {
    socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '방이 끝났어요!' });
    return;
  }
  const roomName = `room:${code}`;
  const userId = socket.data.userId;

  const state = await getRoomState(code);
  if (!state) {
    socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '방이 끝났어요!' });
    return;
  }
  if (state.status !== 'AWARD' && state.status !== 'LOBBY') {
    socket.emit('error', { code: 'GAME_IN_PROGRESS', message: '이미 게임이 시작됐어요!' });
    return;
  }
  const player = state.players.find(p => p.id === userId);
  if (!player) {
    socket.emit('error', { code: 'ALREADY_LEFT', message: '이미 방에서 나왔어요!' });
    return;
  }
  if (!socket.rooms.has(roomName)) await socket.join(roomName);

  if (!player.inAward) {
    game.to(`user:${userId}`).emit(SERVER_EVENT.ROOM_STATE, state);
    return;
  }

  player.inAward = false;
  player.isReady = false;
  await saveRoomState(state);

  await setPresence(userId, 'IN_LOBBY');
  broadcastPresenceUpdate(userId, 'IN_LOBBY');

  if (state.status === 'AWARD') {
    await finishAward(game, code);
    return;
  }
  game.to(roomName).emit(SERVER_EVENT.ROOM_STATE, state);
}
