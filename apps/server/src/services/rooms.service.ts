import { redis } from '../db/redis.js';
import type { RoomState, RoomConfig, Player, RoomListItem } from '@sketch-catch/shared';
import crypto from 'node:crypto';

export class RoomNotFoundError extends Error { code = 'ROOM_NOT_FOUND' as const; }
export class RoomFullError extends Error { code = 'ROOM_FULL' as const; }
export class RoomLockedError extends Error { code = 'ROOM_LOCKED' as const; }
export class WrongPasswordError extends Error { code = 'WRONG_PASSWORD' as const; }

// 방 상태 키 TTL(초) — saveRoomState는 KEEPTTL이라 방은 생성 후 이 시간이 지나면 반드시 만료된다
const ROOM_TTL_SEC = 7200;
// 방 찾기용 인덱스 — ZSET(member=code, score=생성 시각 ms). KEYS 스캔 없이 목록을 만들기 위해 생성·삭제 시점에 갱신
export const ROOM_INDEX_KEY = 'rooms:index';
// 한 번에 읽는 최신 방 수 상한 — MGET 한 번으로 끝나는 크기
const ROOM_LIST_LIMIT = 100;

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
  userMeta: Record<string, { nickname: string; characterId: string; friendCode: string }>;
}): Promise<RoomState> {
  const code = generateRoomCode();

  const players: Player[] = opts.userIds.map((id, i) => {
    const meta = opts.userMeta[id] ?? { nickname: '', characterId: '', friendCode: '' };
    return {
      id,
      nickname: meta.nickname,
      friendCode: meta.friendCode,
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

  await redis.set(`room:${code}:state`, JSON.stringify(state), 'EX', ROOM_TTL_SEC);
  await redis.zadd(ROOM_INDEX_KEY, Date.now(), code);
  if (opts.locked && opts.password) {
    await setRoomPassword(code, opts.password);
  }
  return state;
}

export async function removeRoomFromIndex(code: string): Promise<void> {
  await redis.zrem(ROOM_INDEX_KEY, code);
}

function toRoomListItem(state: RoomState, hasPassword: boolean): RoomListItem {
  const locked = state.locked ?? false;
  return {
    code: state.code,
    title: state.title ?? '게임 방',
    status: state.status === 'LOBBY' ? 'WAITING' : 'PLAYING',
    mode: state.mode,
    playerCount: state.players.filter(p => !p.inAward && !p.left).length,
    playerCountMax: state.config.playerCountMax,
    hasPassword: locked && hasPassword,
    inviteOnly: locked && !hasPassword,
    categories: state.config.categories,
  };
}

/**
 * 방 찾기 목록 — 대기 중 우선, 같은 상태끼리는 최신순.
 * 인덱스에 남았지만 상태 키가 사라진 방(TTL 만료·비정상 종료)은 조회하면서 정리한다.
 */
export async function listRooms(): Promise<RoomListItem[]> {
  await redis.zremrangebyscore(ROOM_INDEX_KEY, '-inf', `(${Date.now() - ROOM_TTL_SEC * 1000}`);

  const codes = await redis.zrevrange(ROOM_INDEX_KEY, 0, ROOM_LIST_LIMIT - 1);
  if (codes.length === 0) return [];

  const [states, passwords] = await Promise.all([
    redis.mget(codes.map(code => `room:${code}:state`)),
    redis.mget(codes.map(code => `room:${code}:password`)),
  ]);

  const stale: string[] = [];
  const items: RoomListItem[] = [];
  codes.forEach((code, i) => {
    const raw = states[i];
    if (!raw) {
      stale.push(code);
      return;
    }
    const item = toRoomListItem(JSON.parse(raw) as RoomState, passwords[i] != null);
    // 전원이 퇴장·시상식 잔류 중인 방은 들어가도 같이 할 사람이 없다
    if (item.playerCount > 0) items.push(item);
  });
  if (stale.length > 0) await redis.zrem(ROOM_INDEX_KEY, ...stale);

  // codes가 이미 최신순이라 안정 정렬로 상태만 나누면 각 그룹 안의 최신순이 유지된다
  return items.sort((a, b) => Number(a.status === 'PLAYING') - Number(b.status === 'PLAYING'));
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
  if (state.players.filter(p => !p.inAward && !p.left).length >= state.config.playerCountMax) throw new RoomFullError();
  if (state.locked) {
    const storedPw = await getRoomPassword(state.code);
    if (storedPw === null) throw new RoomLockedError();
    if (storedPw !== password) throw new WrongPasswordError();
  }
}
