import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { enqueueMatch, dequeueMatch } from '../services/match.service.js';
import { logger } from '../lib/logger.js';

const matchBodySchema = z.object({
  mode: z.union([z.literal(1), z.literal(2)]),
});

export const matchRoutes: FastifyPluginAsync = async (app) => {
  // POST /match — 매칭 로비 진입. 실제 방 배정은 카운트다운 종료 후 소켓(match:found)으로 push되므로 여기선 큐 등록만 한다.
  app.post('/match', { preHandler: authenticate }, async (req, reply) => {
    const parsed = matchBodySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_INPUT' });

    try {
      await enqueueMatch(req.userId!, parsed.data.mode);
      return reply.status(204).send();
    } catch (err) {
      logger.error({ err }, 'POST /match failed — 매칭에 실패했습니다.');
      return reply.status(500).send({ error: 'INTERNAL' });
    }
  });

  // DELETE /match — 큐 즉시 제거 (ROOM-04: 취소)
  app.delete('/match', { preHandler: authenticate }, async (req, reply) => {
    try {
      await dequeueMatch(req.userId!);
      return reply.status(204).send();
    } catch (err) {
      logger.error({ err }, 'DELETE /match failed');
      return reply.status(500).send({ error: 'INTERNAL' });
    }
  });
};
