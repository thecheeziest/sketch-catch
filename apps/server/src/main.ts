import Fastify from 'fastify';
import cors from '@fastify/cors';
import socketioPlugin from 'fastify-socket.io';
import type { Server } from 'socket.io';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { connectPrisma, disconnectPrisma } from './db/prisma.js';
import { connectRedis, disconnectRedis } from './db/redis.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { friendsRoutes } from './routes/friends.js';
import { roomsRoutes } from './routes/rooms.js';
import { invitesRoutes } from './routes/invites.js';
import { matchRoutes } from './routes/match.js';
import { replaysRoutes } from './routes/replays.js';
import { appVersionRoutes } from './routes/appVersion.js';
import { isOutdatedClient } from './lib/appVersion.js';
import { registerGameNamespace } from './socket/game.namespace.js';
import { registerPresenceNamespace } from './socket/presence.namespace.js';
// shared 패키지 import 검증 — 빌드 시 워크스페이스 resolution 확인
import {
  APP_CLIENT_HEADER,
  SHARED_PACKAGE_VERSION,
  SOCKET_NAMESPACE,
  UPDATE_REQUIRED_CODE,
  type ClientEvents,
  type ServerEvents,
} from '@sketch-catch/shared';

async function bootstrap(): Promise<void> {
  logger.info({ shared: SHARED_PACKAGE_VERSION, namespace: SOCKET_NAMESPACE }, 'shared package loaded');

  const app = Fastify({ logger });

  await app.register(cors, { origin: true });
  // Socket.io 플러그인 등록 — app.io 데코레이터 사용 가능해짐
  await app.register(socketioPlugin, { cors: { origin: true } });

  // 최소 빌드 미달 앱의 요청은 전부 거부 — 서버와 버전이 어긋난 클라이언트로 게임에 들어오지 못하게 한다.
  // 버전 확인(/app/version)·헬스체크는 예외.
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/app/version') || req.url.startsWith('/health')) return;
    if (isOutdatedClient(req.headers[APP_CLIENT_HEADER.PLATFORM], req.headers[APP_CLIENT_HEADER.BUILD])) {
      return reply.status(426).send({ error: UPDATE_REQUIRED_CODE });
    }
  });

  await app.register(healthRoutes);
  await app.register(appVersionRoutes);
  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(friendsRoutes);
  await app.register(roomsRoutes);
  await app.register(invitesRoutes);
  await app.register(matchRoutes);
  await app.register(replaysRoutes);

  await connectPrisma();
  await connectRedis();

  // app.ready() 후에만 app.io 접근 가능 (RESEARCH.md §Pattern 1)
  await app.ready();
  registerGameNamespace(app.io as Server<ClientEvents, ServerEvents>);
  registerPresenceNamespace(app.io as Server);

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    await app.close();
    await disconnectPrisma();
    await disconnectRedis();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  // 핸들러 밖으로 새어 나온 비동기 에러는 기록만 하고 프로세스는 유지 — 크래시 1건이 모든 방의 타이머를 날리던 문제 방지
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'unhandled promise rejection');
  });
  // 동기 예외는 프로세스 상태를 신뢰할 수 없으므로 기록 후 종료 (Railway가 재시작)
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught exception');
    process.exit(1);
  });
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  const address = await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info({ address }, 'server listening');
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'failed to bootstrap');
  process.exit(1);
});
