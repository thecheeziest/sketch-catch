import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../auth/jwt.js';
import { redis, setPresence, getPresence } from '../db/redis.js';
import { broadcastPresenceUpdate } from '../socket/presence.namespace.js';

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
  // IN_LOBBY / IN_GAME 상태는 소켓 lifecycle이 관리하므로 덮어쓰지 않음
  // OFFLINE → ONLINE 전환 또는 ONLINE TTL 갱신 목적으로만 호출
  const currentPresence = await getPresence(payload.sub);
  if (currentPresence !== 'IN_LOBBY' && currentPresence !== 'IN_GAME') {
    await setPresence(payload.sub);
    broadcastPresenceUpdate(payload.sub, 'ONLINE');
  }
}
