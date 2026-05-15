import type { FastifyPluginAsync } from 'fastify';
import { updateMeSchema } from '@sketch-catch/shared';
import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';
import { authenticate } from '../middleware/authenticate.js';
import { updateMe, deleteMe, NicknameCooldownError, UserNotFoundError } from '../services/me.service.js';
import { NicknameCodeConflictError } from '../services/user.service.js';
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

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.userId!;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });
    return reply.send(userToPrivate(user));
  });

  app.patch('/me', { preHandler: authenticate }, async (request, reply) => {
    const parsed = updateMeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'INVALID_INPUT', issues: parsed.error.flatten() });
    }
    const userId = request.userId!;
    try {
      const updated = await updateMe(userId, parsed.data);
      return reply.send(userToPrivate(updated));
    } catch (err) {
      if (err instanceof NicknameCooldownError) {
        return reply.status(429).send({ error: err.code, nextChangeAt: err.nextChangeAt });
      }
      if (err instanceof NicknameCodeConflictError) {
        return reply.status(409).send({ error: err.code });
      }
      if (err instanceof UserNotFoundError) {
        return reply.status(404).send({ error: 'NOT_FOUND' });
      }
      logger.error({ err }, 'PATCH /me failed');
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
