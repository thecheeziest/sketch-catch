import { redis } from '../db/redis.js';
import { env } from '../lib/env.js';
import { signTokens, ttlToSeconds } from './jwt.js';

// 단일 기기 정책 — 현재 기기의 access/refresh 토큰을 Redis에 기록하고, 다른 토큰은 거부한다
const REVOKED = 'revoked';

// 현재 유효한 refresh 토큰을 보관하는 Redis 키
export const refreshSessionKey = (userId: string): string => `session:refresh:${userId}`;

// 로그인 — 토큰을 발급하고 이 기기를 유일한 세션으로 기록한다
export async function startSession(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
  const tokens = await signTokens(userId);
  await redis.set(`session:${userId}`, tokens.accessToken);
  await redis.set(refreshSessionKey(userId), tokens.refreshToken);
  return tokens;
}

// 로그아웃·탈퇴 — 남은 refresh 토큰이 만료될 때까지 재발급을 막는 표시를 남긴다
export async function revokeSession(userId: string): Promise<void> {
  await redis.del(`session:${userId}`);
  await redis.set(refreshSessionKey(userId), REVOKED, 'EX', ttlToSeconds(env.JWT_REFRESH_TTL));
}
