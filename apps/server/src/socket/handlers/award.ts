import type { Namespace } from 'socket.io';
import type { ClientEvents, ServerEvents, RoomState } from '@sketch-catch/shared';
import { AWARD_DURATION_SEC, SERVER_EVENT } from '@sketch-catch/shared';
import { getRoomState, saveRoomState } from '../../services/rooms.service.js';
import { clearRoomTimers, setRoomTimer } from '../../services/roomTimers.js';
import { clearRoomChat } from '../../services/chatStore.js';
import { ensureHost, resetToLobby } from '../../services/roomRules.js';
import { redis, setPresence, getUserRoom, clearUserRoom } from '../../db/redis.js';
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
 * 남아 있는 유저는 전원 inAward=true. [한번 더!]를 누르면 대기실로, 만료까지 안 누르면 퇴장 처리.
 */
export async function beginAward(game: GameNamespace, state: RoomState): Promise<void> {
  const durationSec = AWARD_DURATION_SEC[state.mode];
  state.awardEndsAt = Date.now() + durationSec * 1000;
  state.allReady = false;
  for (const p of state.players) {
    p.inAward = !p.left;
    p.isReady = false;
  }
  await saveRoomState(state);

  const { code, gameId } = state;
  setRoomTimer(code, 'award', durationSec * 1000, () => finishAward(game, code, gameId));
}

// 방에서 제거되는 유저의 소켓을 room 채널에서 빼고, 아직 이 방을 가리키는 presence만 정리한다
// (그 사이 다른 방을 만든 유저의 상태를 덮어쓰지 않도록 userRoom이 이 방일 때만)
async function detachUser(game: GameNamespace, code: string, userId: string): Promise<void> {
  game.in(`user:${userId}`).socketsLeave(`room:${code}`);
  if ((await getUserRoom(userId)) !== code) return;
  await clearUserRoom(userId);
  await setPresence(userId, 'ONLINE');
  broadcastPresenceUpdate(userId, 'ONLINE');
}

/**
 * 시상식 종료 — 만료 타이머 또는 남은 시상식 유저가 0명이 됐을 때 호출.
 * inAward(미선택)·left 유저를 제거하고, 남은 유저로 대기실(LOBBY)을 다시 연다. 아무도 없으면 방 삭제.
 */
export async function finishAward(game: GameNamespace, code: string, expectedGameId?: string): Promise<void> {
  const state = await getRoomState(code);
  if (!state || state.status !== 'AWARD') return;
  if (expectedGameId !== undefined && state.gameId !== expectedGameId) return;

  clearRoomTimers(code);

  const removed = state.players.filter(p => p.inAward || p.left);
  const remaining = state.players.filter(p => !p.inAward && !p.left);

  for (const p of removed) await detachUser(game, code, p.id);

  if (remaining.length === 0) {
    await destroyRoom(code);
    return;
  }

  state.players = remaining;
  ensureHost(state, removed);
  resetToLobby(state);
  await saveRoomState(state);

  const roomName = `room:${code}`;
  game.to(roomName).emit(SERVER_EVENT.ROOM_STATE, state);
  for (const p of removed) game.to(roomName).emit(SERVER_EVENT.ROOM_PLAYER_LEAVE, { userId: p.id });
}

// 시상식에서 [한번 더!] — 해당 유저만 대기실로 복귀. 남은 시상식 유저가 없으면 즉시 대기실 전환
export async function handleRematch(
  game: GameNamespace,
  socket: { rooms: Set<string>; data: { userId: string } },
): Promise<void> {
  const roomName = Array.from(socket.rooms).find(r => r.startsWith('room:'));
  if (!roomName) return;
  const code = roomName.replace('room:', '');
  const userId = socket.data.userId;

  const state = await getRoomState(code);
  if (!state || state.status !== 'AWARD') return;
  const player = state.players.find(p => p.id === userId);
  if (!player || !player.inAward) return;

  player.inAward = false;
  player.isReady = false;
  await saveRoomState(state);

  await setPresence(userId, 'IN_LOBBY');
  broadcastPresenceUpdate(userId, 'IN_LOBBY');

  if (!state.players.some(p => p.inAward)) {
    await finishAward(game, code);
    return;
  }
  game.to(roomName).emit(SERVER_EVENT.ROOM_STATE, state);
}
