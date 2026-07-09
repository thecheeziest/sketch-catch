import { redis } from '../db/redis.js';
import type { RoomState, RoomConfig, Player } from '@sketch-catch/shared';
import crypto from 'node:crypto';

export class RoomNotFoundError extends Error { code = 'ROOM_NOT_FOUND' as const; }
export class RoomFullError extends Error { code = 'ROOM_FULL' as const; }
export class RoomLockedError extends Error { code = 'ROOM_LOCKED' as const; }
export class WrongPasswordError extends Error { code = 'WRONG_PASSWORD' as const; }

function generateRoomCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
}

export async function setRoomPassword(code: string, password: string): Promise<void> {
  await redis.set(`room:${code}:password`, password, 'EX', 7200);
}

export async function getRoomPassword(code: string): Promise<string | null> {
  return redis.get(`room:${code}:password`);
}

export async function clearRoomPassword(code: string): Promise<void> {
  await redis.del(`room:${code}:password`);
}

export async function createRoom(opts: {
  hostId: string;
  userIds: string[];
  config: RoomConfig;
  title?: string;
  locked: boolean;
  password?: string;
  mode: 1 | 2;
  userMeta: Record<string, { nickname: string; characterId: string }>;
}): Promise<RoomState> {
  const code = generateRoomCode();

  const players: Player[] = opts.userIds.map((id, i) => {
    const meta = opts.userMeta[id] ?? { nickname: '', characterId: '' };
    return {
      id,
      nickname: meta.nickname,
      friendCode: '',
      characterId: meta.characterId,
      slot: i,
      isHost: id === opts.hostId,
      isReady: false,
      connected: true,
    };
  });

  const hostMeta = opts.userMeta[opts.hostId];
  const defaultTitle = hostMeta ? `${hostMeta.nickname}의 방` : '게임 방';

  const state: RoomState = {
    code,
    hostId: opts.hostId,
    mode: opts.mode,
    status: 'LOBBY',
    players,
    config: opts.config,
    scoreboard: {},
    current: null,
    title: opts.title ?? defaultTitle,
    locked: opts.locked,
  };

  await redis.set(`room:${code}:state`, JSON.stringify(state), 'EX', 7200);
  if (opts.locked && opts.password) {
    await setRoomPassword(code, opts.password);
  }
  return state;
}

export async function getRoomState(code: string): Promise<RoomState | null> {
  const raw = await redis.get(`room:${code}:state`);
  if (!raw) return null;
  return JSON.parse(raw) as RoomState;
}

export async function saveRoomState(state: RoomState): Promise<void> {
  await redis.set(`room:${state.code}:state`, JSON.stringify(state), 'KEEPTTL');
}

export async function assertJoinable(state: RoomState, password?: string): Promise<void> {
  if (state.players.length >= state.config.playerCountMax) throw new RoomFullError();
  if (state.locked) {
    const storedPw = await getRoomPassword(state.code);
    if (storedPw === null) throw new RoomLockedError();
    if (storedPw !== password) throw new WrongPasswordError();
  }
}
