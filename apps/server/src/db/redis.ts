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

const PRESENCE_TTL_SECONDS = 300; // 5분

export type PresenceStatus = 'ONLINE' | 'OFFLINE' | 'IN_GAME';

export async function setPresence(userId: string, status: PresenceStatus = 'ONLINE'): Promise<void> {
  await redis.set(`user:presence:${userId}`, status, 'EX', PRESENCE_TTL_SECONDS);
}

export async function getPresence(userId: string): Promise<PresenceStatus> {
  const val = await redis.get(`user:presence:${userId}`);
  if (val === 'ONLINE' || val === 'IN_GAME') return val;
  return 'OFFLINE';
}
