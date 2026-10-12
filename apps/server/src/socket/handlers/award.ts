import type { Namespace } from 'socket.io';
import type { ClientEvents, ServerEvents, RoomState } from '@sketch-catch/shared';
import { SERVER_EVENT } from '@sketch-catch/shared';
import { getRoomState, saveRoomState } from '../../services/rooms.service.js';
import { clearRoomTimers } from '../../services/roomTimers.js';
import { clearRoomChat } from '../../services/chatStore.js';
import { ensureHost, resetToLobby } from '../../services/roomRules.js';
import { redis, setPresence } from '../../db/redis.js';
import { broadcastPresenceUpdate } from '../presence.namespace.js';

type GameNamespace = Namespace<ClientEvents, ServerEvents>;

// 방의 Redis 상태와 메모리 런타임(타이머·채팅 저장소)을 함께 정리
export async function destroyRoom(code: string): Promise<void> {
  clearRoomTimers(code);
  clearRoomChat(code);
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
  await saveRoomState(state);
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

  if (remaining.length === 0) {
    await destroyRoom(code);
    return;
  }

  state.players = remaining;
  const viewers = new Set(remaining.filter(p => p.inAward).map(p => p.id));
  resetToLobby(state);
  for (const p of remaining) p.inAward = viewers.has(p.id);
  ensureHost(state, removed);
  await saveRoomState(state);

  const roomName = `room:${code}`;
  game.to(roomName).emit(SERVER_EVENT.ROOM_STATE, state);
  for (const p of removed) game.to(roomName).emit(SERVER_EVENT.ROOM_PLAYER_LEAVE, { userId: p.id });
}

// 시상식에서 [한번 더!] — 선택한 유저만 대기실로 복귀, 다른 유저는 시상식 유지
export async function handleRematch(
  game: GameNamespace,
  socket: {
    rooms: Set<string>;
    data: { userId: string };
    emit: (event: 'error', payload: { code: string; message: string }) => void;
  },
): Promise<void> {
  const roomName = Array.from(socket.rooms).find(r => r.startsWith('room:'));
  if (!roomName) return;
  const code = roomName.replace('room:', '');
  const userId = socket.data.userId;

  const state = await getRoomState(code);
  if (!state) {
    socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '방이 종료되었어요' });
    return;
  }
  if (state.status !== 'AWARD' && state.status !== 'LOBBY') {
    socket.emit('error', { code: 'GAME_IN_PROGRESS', message: '이미 게임이 시작됐어요!' });
    return;
  }
  const player = state.players.find(p => p.id === userId);
  if (!player) {
    socket.emit('error', { code: 'GAME_IN_PROGRESS', message: '이미 게임이 시작됐어요!' });
    return;
  }
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
