import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  // 호스팅 헬스체크·keep-alive 전용 — DB를 건드리지 않아야 Neon 무료 컴퓨트가 유휴 시 정지할 수 있다
  app.get('/ping', async () => ({ status: 'ok' }));

  app.get('/health', async () => {
    const [dbOk, redisOk] = await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      redis.ping().then((r) => r === 'PONG').catch(() => false),
    ]);
    return {
      status: dbOk && redisOk ? 'ok' : 'degraded',
      db: dbOk,
      redis: redisOk,
      timestamp: new Date().toISOString(),
    };
  });
}
