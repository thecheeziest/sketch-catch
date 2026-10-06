import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { kakaoLoginSchema, appleLoginSchema, refreshSchema } from '@sketch-catch/shared';
import { verifyKakaoToken } from '../auth/kakao.js';
import { verifyAppleToken } from '../auth/apple.js';
import { signTokens, verifyRefreshToken, verifyAccessToken } from '../auth/jwt.js';
import { upsertUserByProvider } from '../services/user.service.js';
import { redis } from '../db/redis.js';
import { logger } from '../lib/logger.js';
import { env } from '../lib/env.js';

// 개발 전용 테스트 계정 수 — 모드2 최소 인원(4명)을 기기별로 채울 수 있는 수
const DEV_TEST_ACCOUNT_COUNT = 4;
const devLoginSchema = z.object({ slot: z.number().int().min(1).max(DEV_TEST_ACCOUNT_COUNT) });
// 카카오 providerId는 숫자 문자열이라 접두사 'dev:'와 겹치지 않는다
const DEV_PROVIDER_ID_PREFIX = 'dev:';

function userToPrivate(u: {
  id: string;
  nickname: string;
  friendCode: string;
  characterId: string;
  provider: 'KAKAO' | 'APPLE';
  createdAt: Date;
  nicknameChangedAt: Date | null;
}) {
  return {
    id: u.id,
    nickname: u.nickname,
    friendCode: u.friendCode,
    characterId: u.characterId,
    provider: u.provider,
    createdAt: u.createdAt.toISOString(),
    nicknameChangedAt: u.nicknameChangedAt ? u.nicknameChangedAt.toISOString() : null,
  };
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/kakao', async (request, reply) => {
    const parsed = kakaoLoginSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_TOKEN' });
    try {
      const claims = await verifyKakaoToken(parsed.data.idToken);
      const { user, isNew } = await upsertUserByProvider({ provider: 'KAKAO', providerId: claims.sub });
      const tokens = await signTokens(user.id);
      // D-05: 단일 기기 — 기존 세션 덮어쓰기
      await redis.set(`session:${user.id}`, tokens.accessToken);
      return reply.send({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        needsOnboarding: isNew,
        user: userToPrivate(user),
      });
    } catch (err) {
      logger.warn({ err }, 'kakao token verify failed');
      return reply.status(401).send({ error: 'INVALID_TOKEN' });
    }
  });

  app.post('/auth/apple', async (request, reply) => {
    const parsed = appleLoginSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_TOKEN' });
    try {
      const claims = await verifyAppleToken(parsed.data.identityToken);
      const { user, isNew } = await upsertUserByProvider({ provider: 'APPLE', providerId: claims.sub });
      const tokens = await signTokens(user.id);
      await redis.set(`session:${user.id}`, tokens.accessToken);
      return reply.send({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        needsOnboarding: isNew,
        user: userToPrivate(user),
      });
    } catch (err) {
      logger.warn({ err }, 'apple token verify failed');
      return reply.status(401).send({ error: 'INVALID_TOKEN' });
    }
  });

  // 개발 전용: 카카오/애플 인증 없이 테스트 계정으로 로그인 (다기기 동시성 테스트용).
  // production에서는 플래그와 무관하게 라우트 자체를 등록하지 않는다.
  if (env.ENABLE_DEV_LOGIN && env.NODE_ENV !== 'production') {
    app.post('/auth/dev', async (request, reply) => {
      const parsed = devLoginSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: 'INVALID_INPUT' });
      const { user, isNew } = await upsertUserByProvider({
        provider: 'KAKAO',
        providerId: `${DEV_PROVIDER_ID_PREFIX}${parsed.data.slot}`,
      });
      const tokens = await signTokens(user.id);
      await redis.set(`session:${user.id}`, tokens.accessToken);
      return reply.send({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        needsOnboarding: isNew,
        user: userToPrivate(user),
      });
    });
  }

  app.post('/auth/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_TOKEN' });
    const payload = await verifyRefreshToken(parsed.data.refreshToken);
    if (!payload) return reply.status(401).send({ error: 'INVALID_TOKEN' });
    const tokens = await signTokens(payload.sub);
    // 단일 기기 정책: refresh 시에도 session 갱신
    await redis.set(`session:${payload.sub}`, tokens.accessToken);
    return reply.send({ accessToken: tokens.accessToken });
  });

  app.post('/auth/logout', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'UNAUTHORIZED' });
    }
    const token = authHeader.slice(7);
    const payload = await verifyAccessToken(token);
    if (!payload) return reply.status(401).send({ error: 'INVALID_TOKEN' });
    await redis.del(`session:${payload.sub}`, `user:presence:${payload.sub}`);
    return reply.send({ ok: true });
  });
};
