import Redis from 'ioredis';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis error');
});

export async function connectRedis(): Promise<void> {
  await redis.connect();
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}

// ONLINE: 5분 (앱 열린 채 방 없는 상태 — 자주 갱신 불필요, 만료=오프라인)
// IN_LOBBY / IN_GAME: 소켓 연결 유지 중이므로 방 퇴장 시 명시적 초기화. TTL은 비정상 종료 대비 안전망.
const PRESENCE_TTL: Record<string, number> = {
  ONLINE:   300,   // 5분
  IN_LOBBY: 3600,  // 1시간
  IN_GAME:  7200,  // 2시간 (게임 세션 최대 길이 감안)
};

export type PresenceStatus = 'ONLINE' | 'OFFLINE' | 'IN_LOBBY' | 'IN_GAME';

export async function setPresence(userId: string, status: PresenceStatus = 'ONLINE'): Promise<void> {
  const ttl = PRESENCE_TTL[status] ?? 300;
  await redis.set(`user:presence:${userId}`, status, 'EX', ttl);
}

export async function getPresence(userId: string): Promise<PresenceStatus> {
  const val = await redis.get(`user:presence:${userId}`);
  if (val === 'ONLINE' || val === 'IN_LOBBY' || val === 'IN_GAME') return val;
  return 'OFFLINE';
}

export async function setUserRoom(userId: string, code: string): Promise<void> {
  await redis.set(`user:room:${userId}`, code, 'EX', 7200);
}

export async function getUserRoom(userId: string): Promise<string | null> {
  return redis.get(`user:room:${userId}`);
}

export async function clearUserRoom(userId: string): Promise<void> {
  await redis.del(`user:room:${userId}`);
}
