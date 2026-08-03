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

// 동시 입장 시 슬롯 번호 등 read-modify-write 충돌 방지용 방 단위 락.
// 짧은 임계구역(get→mutate→save)만 감싸는 용도라 SET NX + 짧은 폴링 재시도로 충분.
const LOCK_TTL_SEC = 5;
const LOCK_RETRY_MS = 30;
const LOCK_MAX_ATTEMPTS = 50; // ~1.5초

export async function withRoomLock<T>(code: string, fn: () => Promise<T>): Promise<T> {
  const lockKey = `room:${code}:lock`;
  let acquired = false;
  for (let attempt = 0; attempt < LOCK_MAX_ATTEMPTS; attempt++) {
    const result = await redis.set(lockKey, '1', 'EX', LOCK_TTL_SEC, 'NX');
    if (result === 'OK') {
      acquired = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
  }
  if (!acquired) throw new Error(`ROOM_LOCK_TIMEOUT: ${code}`);

  try {
    return await fn();
  } finally {
    await redis.del(lockKey);
  }
}

export async function assertJoinable(state: RoomState, password?: string): Promise<void> {
  if (state.players.length >= state.config.playerCountMax) throw new RoomFullError();
  if (state.locked) {
    const storedPw = await getRoomPassword(state.code);
    if (storedPw === null) throw new RoomLockedError();
    if (storedPw !== password) throw new WrongPasswordError();
  }
}
