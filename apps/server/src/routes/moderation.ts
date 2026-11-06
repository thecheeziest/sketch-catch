import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { blockUserSchema, reportUserSchema } from '@sketch-catch/shared';
import { authenticate } from '../middleware/authenticate.js';
import {
  blockUser,
  listBlockedUsers,
  ModerationTargetNotFoundError,
  reportUser,
  SelfModerationError,
  unblockUser,
} from '../services/moderation.service.js';
import { logger } from '../lib/logger.js';

const targetParamSchema = z.object({ targetId: z.string().uuid() });

function replyModerationError(reply: FastifyReply, err: unknown, route: string): FastifyReply {
  if (err instanceof SelfModerationError) return reply.status(400).send({ error: err.code });
  if (err instanceof ModerationTargetNotFoundError) return reply.status(404).send({ error: err.code });
  logger.error({ err }, `${route} failed`);
  return reply.status(500).send({ error: 'INTERNAL' });
}

// 차단·신고 — 앱스토어 사용자 생성 콘텐츠 정책 대응
export const moderationRoutes: FastifyPluginAsync = async app => {
  app.get('/blocks', { preHandler: authenticate }, async (req, reply) => {
    return reply.send(await listBlockedUsers(req.userId!));
  });

  app.post('/blocks', { preHandler: authenticate }, async (req, reply) => {
    const parsed = blockUserSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_INPUT' });
    try {
      await blockUser(req.userId!, parsed.data.targetId);
      return reply.status(201).send({ ok: true });
    } catch (err) {
      return replyModerationError(reply, err, 'POST /blocks');
    }
  });

  app.delete('/blocks/:targetId', { preHandler: authenticate }, async (req, reply) => {
    const parsed = targetParamSchema.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_INPUT' });
    await unblockUser(req.userId!, parsed.data.targetId);
    return reply.send({ ok: true });
  });

  app.post('/reports', { preHandler: authenticate }, async (req, reply) => {
    const parsed = reportUserSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_INPUT' });
    try {
      await reportUser(req.userId!, parsed.data);
      return reply.status(201).send({ ok: true });
    } catch (err) {
      return replyModerationError(reply, err, 'POST /reports');
    }
  });
};
