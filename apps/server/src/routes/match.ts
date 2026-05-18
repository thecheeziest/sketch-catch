import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { enqueueMatch, dequeueMatch } from '../services/match.service.js';
import { logger } from '../lib/logger.js';

// D-08: 6/8/10명만
const matchBodySchema = z.object({
  playerCount: z.union([z.literal(6), z.literal(8), z.literal(10)]),
});

export const matchRoutes: FastifyPluginAsync = async (app) => {
  // POST /match — 큐 진입 (인원 충족 시 즉시 방 생성)
  app.post('/match', { preHandler: authenticate }, async (req, reply) => {
    const parsed = matchBodySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_INPUT' });

    try {
      const result = await enqueueMatch(req.userId!, parsed.data.playerCount);
      if (result) {
        // 즉시 매칭됨 — 방 코드 반환
        return reply.send({ matched: true, code: result.code });
      }
      // 인원 미충족 — 대기 중
      return reply.send({ matched: false });
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
