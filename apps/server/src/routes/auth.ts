import type { FastifyPluginAsync } from 'fastify';
import { kakaoLoginSchema, appleLoginSchema, refreshSchema } from '@sketch-catch/shared';
import { verifyKakaoToken } from '../auth/kakao.js';
import { verifyAppleToken } from '../auth/apple.js';
import { signTokens, verifyRefreshToken, verifyAccessToken } from '../auth/jwt.js';
import { upsertUserByProvider } from '../services/user.service.js';
import { redis } from '../db/redis.js';
import { logger } from '../lib/logger.js';

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
