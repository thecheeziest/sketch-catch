import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import socketioPlugin from 'fastify-socket.io';
import type { Server } from 'socket.io';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { connectPrisma, disconnectPrisma } from './db/prisma.js';
import { connectRedis, disconnectRedis } from './db/redis.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { shopRoutes } from './routes/shop.js';
import { friendsRoutes } from './routes/friends.js';
import { roomsRoutes } from './routes/rooms.js';
import { invitesRoutes } from './routes/invites.js';
import { matchRoutes } from './routes/match.js';
import { replaysRoutes } from './routes/replays.js';
import { appVersionRoutes } from './routes/appVersion.js';
import { moderationRoutes } from './routes/moderation.js';
import { isOutdatedClient } from './lib/appVersion.js';
import { deleteExpiredReplays } from './services/replay.service.js';
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

// 사용자 1명 기준 분당 REST 요청 상한 — 정상 사용(폴링 포함)은 분당 수십 회 수준
const RATE_LIMIT_PER_MINUTE = 300;
const REPLAY_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

async function bootstrap(): Promise<void> {
  logger.info({ shared: SHARED_PACKAGE_VERSION, namespace: SOCKET_NAMESPACE }, 'shared package loaded');

  // Render 프록시 뒤에서 실제 접속 IP를 req.ip로 쓰기 위해 X-Forwarded-For를 신뢰한다
  const app = Fastify({ logger, trustProxy: true });

  await app.register(cors, { origin: true });
  // REST 과호출 방지 — 로그인 사용자는 토큰 단위, 비로그인 요청은 IP 단위로 센다 (소켓 이벤트는 대상 아님)
  await app.register(rateLimit, {
    max: RATE_LIMIT_PER_MINUTE,
    timeWindow: '1 minute',
    allowList: req => req.url.startsWith('/ping') || req.url.startsWith('/health'),
    keyGenerator: req => req.headers.authorization ?? req.ip,
    errorResponseBuilder: () => ({ statusCode: 429, error: 'RATE_LIMITED' }),
  });
  // Socket.io 플러그인 등록 — app.io 데코레이터 사용 가능해짐
  await app.register(socketioPlugin, { cors: { origin: true } });

  // 최소 빌드 미달 앱의 요청은 전부 거부 — 서버와 버전이 어긋난 클라이언트로 게임에 들어오지 못하게 한다.
  // 버전 확인(/app/version)·헬스체크(/health, /ping)는 예외.
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/app/version') || req.url.startsWith('/health') || req.url.startsWith('/ping')) return;
    if (isOutdatedClient(req.headers[APP_CLIENT_HEADER.PLATFORM], req.headers[APP_CLIENT_HEADER.BUILD])) {
      return reply.status(426).send({ error: UPDATE_REQUIRED_CODE });
    }
  });

  await app.register(healthRoutes);
  await app.register(appVersionRoutes);
  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(shopRoutes);
  await app.register(friendsRoutes);
  await app.register(roomsRoutes);
  await app.register(invitesRoutes);
  await app.register(matchRoutes);
  await app.register(replaysRoutes);
  await app.register(moderationRoutes);

  await connectPrisma();
  await connectRedis();

  // 만료된 다시보기 정리 — 기동 직후 한 번, 이후 1시간마다
  const cleanReplays = (): void => {
    deleteExpiredReplays()
      .then(count => count > 0 && logger.info({ count }, 'expired replays deleted'))
      .catch(err => logger.error({ err }, 'expired replay cleanup failed'));
  };
  cleanReplays();
  setInterval(cleanReplays, REPLAY_CLEANUP_INTERVAL_MS).unref();

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
