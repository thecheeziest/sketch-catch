import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { updateMeSchema, onboardingSchema } from '@sketch-catch/shared';
import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';
import { authenticate } from '../middleware/authenticate.js';
import { updateMe, onboard, deleteMe, NicknameCooldownError, UserNotFoundError } from '../services/me.service.js';
import { NicknameCodeConflictError } from '../services/user.service.js';
import { ItemNotOwnedError } from '../services/coin.service.js';
import { USER_WITH_ITEMS, toUserPrivate } from '../lib/userPrivate.js';
import { logger } from '../lib/logger.js';

const pushDiagnosticSchema = z.object({
  result: z.enum(['registered', 'denied', 'error']),
  permission: z.string().max(32).optional(),
  message: z.string().max(500).optional(),
  platform: z.string().max(16).optional(),
});

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.userId!;
    const user = await prisma.user.findUnique({ where: { id: userId }, include: USER_WITH_ITEMS });
    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });
    return reply.send(toUserPrivate(user));
  });

  app.post('/me/onboard', { preHandler: authenticate }, async (request, reply) => {
    const parsed = onboardingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'INVALID_INPUT', issues: parsed.error.flatten() });
    }
    const userId = request.userId!;
    try {
      const updated = await onboard(userId, parsed.data);
      return reply.send(toUserPrivate(updated));
    } catch (err) {
      if (err instanceof NicknameCodeConflictError) {
        return reply.status(409).send({ error: err.code });
      }
      if (err instanceof UserNotFoundError) {
        return reply.status(404).send({ error: 'NOT_FOUND' });
      }
      logger.error({ err }, 'POST /me/onboard failed');
      return reply.status(500).send({ error: 'INTERNAL' });
    }
  });

  app.patch('/me', { preHandler: authenticate }, async (request, reply) => {
    const parsed = updateMeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'INVALID_INPUT', issues: parsed.error.flatten() });
    }
    const userId = request.userId!;
    try {
      const updated = await updateMe(userId, parsed.data);
      return reply.send(toUserPrivate(updated));
    } catch (err) {
      if (err instanceof NicknameCooldownError) {
        return reply.status(429).send({ error: err.code, nextChangeAt: err.nextChangeAt });
      }
      if (err instanceof NicknameCodeConflictError) {
        return reply.status(409).send({ error: err.code });
      }
      if (err instanceof ItemNotOwnedError) {
        return reply.status(403).send({ error: err.code });
      }
      if (err instanceof UserNotFoundError) {
        return reply.status(404).send({ error: 'NOT_FOUND' });
      }
      logger.error({ err }, 'PATCH /me failed');
      return reply.status(500).send({ error: 'INTERNAL' });
    }
  });

  app.post('/me/push-token', { preHandler: authenticate }, async (request, reply) => {
    const parsed = z.object({ token: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'INVALID_INPUT' });
    }
    const userId = request.userId!;
    try {
      await prisma.user.update({ where: { id: userId }, data: { pushToken: parsed.data.token } });
      return reply.send({ ok: true });
    } catch (err) {
      logger.error({ err }, 'POST /me/push-token failed');
      return reply.status(500).send({ error: 'INTERNAL' });
    }
  });

  // 푸시 토큰 등록 결과 진단 — TestFlight 빌드는 앱 콘솔을 볼 수 없어 서버 로그로 원인을 확인한다
  app.post('/me/push-diagnostic', { preHandler: authenticate }, async (request, reply) => {
    const parsed = pushDiagnosticSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'INVALID_INPUT' });
    }
    logger.info({ userId: request.userId, ...parsed.data }, 'push registration diagnostic');
    return reply.send({ ok: true });
  });

  app.delete('/me/push-token', { preHandler: authenticate }, async (request, reply) => {
    try {
      await prisma.user.update({ where: { id: request.userId! }, data: { pushToken: null } });
      return reply.send({ ok: true });
    } catch (err) {
      logger.error({ err }, 'DELETE /me/push-token failed');
      return reply.status(500).send({ error: 'INTERNAL' });
    }
  });

  app.delete('/me', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.userId!;
    try {
      await deleteMe(userId);
      await redis.del(`session:${userId}`);
      return reply.send({ ok: true });
    } catch (err) {
      logger.error({ err }, 'DELETE /me failed');
      return reply.status(500).send({ error: 'INTERNAL' });
    }
  });
};
