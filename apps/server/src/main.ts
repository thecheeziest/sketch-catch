import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { connectPrisma, disconnectPrisma } from './db/prisma.js';
import { connectRedis, disconnectRedis } from './db/redis.js';
import { healthRoutes } from './routes/health.js';
// shared 패키지 import 검증 — 빌드 시 워크스페이스 resolution 확인
import { SHARED_PACKAGE_VERSION, SOCKET_NAMESPACE } from '@sketch-catch/shared';

async function bootstrap(): Promise<void> {
  logger.info({ shared: SHARED_PACKAGE_VERSION, namespace: SOCKET_NAMESPACE }, 'shared package loaded');

  const app = Fastify({ logger });

  await app.register(cors, { origin: true });
  await app.register(healthRoutes);

  await connectPrisma();
  await connectRedis();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    await app.close();
    await disconnectPrisma();
    await disconnectRedis();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  const address = await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info({ address }, 'server listening');
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'failed to bootstrap');
  process.exit(1);
});
