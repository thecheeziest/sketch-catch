import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../auth/jwt.js';
import { redis, setPresence } from '../db/redis.js';

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'UNAUTHORIZED' });
    return;
  }
  const token = auth.slice(7);
  const payload = await verifyAccessToken(token);
  if (!payload) {
    reply.status(401).send({ error: 'INVALID_TOKEN' });
    return;
  }
  // D-05/D-06 단일 기기 정책 — Redis session과 토큰 일치 확인
  const sessionToken = await redis.get(`session:${payload.sub}`);
  if (sessionToken !== token) {
    reply.status(401).send({ error: 'SESSION_REPLACED' });
    return;
  }
  request.userId = payload.sub;
  // fire-and-forget: presence 갱신 실패해도 인증 흐름 중단하지 않음
  void setPresence(payload.sub);
}
