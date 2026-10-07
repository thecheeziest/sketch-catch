import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getAppVersionInfo } from '../lib/appVersion.js';

const querySchema = z.object({ platform: z.enum(['ios', 'android']) });

// 인증 없이 호출 — 앱 시작 직후(로그인 전) 스플래시에서 강제 업데이트 여부를 확인한다
export async function appVersionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/app/version', async (req, reply) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_INPUT' });
    return getAppVersionInfo(parsed.data.platform);
  });
}
