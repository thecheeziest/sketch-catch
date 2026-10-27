import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';

const config = vi.hoisted(() => ({
  APPLE_MIGRATION_SOURCE_BUNDLE_ID: 'com.sketchcatch.app' as string | undefined,
  APPLE_MIGRATION_TARGET_BUNDLE_ID: 'com.sketchcatch.ios' as string | undefined,
  JWT_SECRET: 'apple-migration-test-secret-32-characters',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  ENABLE_DEV_LOGIN: false,
}));
vi.mock('../lib/env.js', () => ({ env: config }));
vi.mock('../auth/apple.js', () => ({ verifyAppleToken: vi.fn() }));
vi.mock('../auth/kakao.js', () => ({ verifyKakaoToken: vi.fn() }));
vi.mock('../db/prisma.js', () => ({
  prisma: {
    appleIdentity: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock('../db/redis.js', () => ({
  redis: { set: vi.fn(), eval: vi.fn(), getdel: vi.fn(), get: vi.fn(), del: vi.fn() },
}));
vi.mock('../middleware/authenticate.js', () => ({
  authenticate: async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.authorization !== 'Bearer old-session')
      return reply.status(401).send({ error: 'UNAUTHORIZED' });
    request.userId = 'old-user';
  },
}));

const { prisma } = await import('../db/prisma.js');
const { redis } = await import('../db/redis.js');
const { verifyAppleToken } = await import('../auth/apple.js');
const { verifyAccessToken } = await import('../auth/jwt.js');
const { authRoutes } = await import('../routes/auth.js');
const { appleMigrationRoutes } = await import('../routes/appleMigration.js');
const { issueAppleMigrationCode, linkAppleMigration } = await import('../services/appleMigration.service.js');
const { upsertUserByProvider } = await import('../services/user.service.js');

const oldUser = {
  id: 'old-user',
  provider: 'APPLE' as const,
  providerId: 'old-apple-sub',
  nickname: '기존사용자',
  friendCode: 'ABCDE',
  characterId: 'dog',
  pushToken: null,
  createdAt: new Date('2026-01-01'),
  nicknameChangedAt: null,
  coins: 735,
  frameId: 'pixel-frame',
  backgroundId: null,
  chatColorId: null,
  items: [{ itemId: 'dog' }, { itemId: 'pixel-frame' }],
};
const sourceClaims = { sub: 'old-apple-sub', audience: 'com.sketchcatch.app' };
const targetClaims = { sub: 'new-apple-sub', audience: 'com.sketchcatch.ios' };
const code = '0123456789abcdef0123456789abcdef';
const identities = new Map<string, string>();
const codes = new Map<string, string>();

beforeEach(() => {
  vi.resetAllMocks();
  config.APPLE_MIGRATION_SOURCE_BUNDLE_ID = 'com.sketchcatch.app';
  config.APPLE_MIGRATION_TARGET_BUNDLE_ID = 'com.sketchcatch.ios';
  identities.clear();
  identities.set('old-apple-sub', oldUser.id);
  codes.clear();
  codes.set(`auth:apple-migration:code:${createHash('sha256').update(code).digest('hex')}`, oldUser.id);
  vi.mocked(redis.set).mockResolvedValue('OK');
  vi.mocked(redis.eval).mockResolvedValue(1);
  vi.mocked(redis.getdel).mockImplementation(async key => {
    const value = codes.get(key) ?? null;
    codes.delete(key);
    return value;
  });
  vi.mocked(prisma.appleIdentity.findUnique).mockImplementation(async ({ where }) => {
    const userId = identities.get(where.providerId!);
    if (!userId) return null;
    return { providerId: where.providerId!, userId, createdAt: new Date(), user: { ...oldUser, id: userId } };
  });
  vi.mocked(prisma.appleIdentity.upsert).mockImplementation(async ({ where, create }) => {
    const providerId = where.providerId!;
    const userId = identities.get(providerId) ?? create.userId!;
    identities.set(providerId, userId);
    return { providerId, userId, createdAt: new Date(), user: { ...oldUser, id: userId } };
  });
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
  vi.mocked(verifyAppleToken).mockImplementation(async token => {
    if (token === 'old-proof') return sourceClaims;
    if (token === 'new-proof') return targetClaims;
    throw new Error('invalid token');
  });
});

async function buildApp() {
  const app = Fastify();
  await app.register(authRoutes);
  await app.register(appleMigrationRoutes);
  return app;
}

describe('Apple 계정 이전', () => {
  it('로그인 세션과 기존 Apple 재인증이 일치해야 코드를 발급한다', async () => {
    const result = await issueAppleMigrationCode(oldUser.id, sourceClaims);
    expect(result.code).toMatch(/^[a-f0-9]{32}$/);
    expect(Date.parse(result.expiresAt) - Date.now()).toBeGreaterThan(890_000);
    const args = vi.mocked(redis.eval).mock.calls[0]!;
    expect(args).not.toContain(result.code);
    expect(args[4]).toBe(oldUser.id);
  });

  it('다른 Apple 계정으로는 이전 코드를 발급할 수 없다', async () => {
    await expect(issueAppleMigrationCode('another-user', sourceClaims)).rejects.toMatchObject({
      code: 'MIGRATION_ACCOUNT_MISMATCH',
    });
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it('새 앱에서 기존 계정 이전 코드를 발급할 수 없다', async () => {
    await expect(issueAppleMigrationCode(oldUser.id, targetClaims)).rejects.toMatchObject({
      code: 'MIGRATION_SOURCE_REQUIRED',
    });
  });

  it('발급 요청을 30초에 한 번으로 제한한다', async () => {
    vi.mocked(redis.set).mockResolvedValue(null);
    await expect(issueAppleMigrationCode(oldUser.id, sourceClaims)).rejects.toMatchObject({
      code: 'MIGRATION_RATE_LIMITED',
    });
  });

  it('로그인하지 않은 요청과 잘못된 Apple 본인 확인을 거부한다', async () => {
    const app = await buildApp();
    const unsigned = await app.inject({
      method: 'POST',
      url: '/me/apple-migration-code',
      payload: { identityToken: 'old-proof' },
    });
    expect(unsigned.statusCode).toBe(401);
    const wrongProof = await app.inject({
      method: 'POST',
      url: '/me/apple-migration-code',
      headers: { authorization: 'Bearer old-session' },
      payload: { identityToken: 'invalid' },
    });
    expect(wrongProof.statusCode).toBe(403);
    expect(redis.eval).not.toHaveBeenCalled();
    await app.close();
  });

  it('새 Apple 식별자를 기존 사용자 ID에 연결해 코인·아이템을 유지한다', async () => {
    const app = await buildApp();
    const result = await app.inject({
      method: 'POST',
      url: '/auth/apple',
      payload: { identityToken: 'new-proof', migrationCode: code },
    });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({
      needsOnboarding: false,
      user: { id: oldUser.id, coins: 735, ownedItemIds: ['dog', 'pixel-frame'], friendCode: 'ABCDE' },
    });
    expect(await verifyAccessToken(result.json().accessToken)).toEqual({ sub: oldUser.id });
    expect(prisma.user.create).not.toHaveBeenCalled();
    await app.close();
  });

  it('연결 이후에는 코드 없이 양쪽 Apple 로그인으로 같은 사용자에 접근한다', async () => {
    await linkAppleMigration(code, targetClaims);
    for (const providerId of ['old-apple-sub', 'new-apple-sub']) {
      const result = await upsertUserByProvider({ provider: 'APPLE', providerId });
      expect(result).toMatchObject({ isNew: false, user: { id: oldUser.id, coins: 735 } });
    }
  });

  it('사용된 코드·만료된 코드를 거부한다', async () => {
    await linkAppleMigration(code, targetClaims);
    await expect(linkAppleMigration(code, targetClaims)).rejects.toMatchObject({ code: 'MIGRATION_CODE_INVALID' });
    await expect(linkAppleMigration('f'.repeat(32), targetClaims)).rejects.toMatchObject({
      code: 'MIGRATION_CODE_INVALID',
    });
    expect(prisma.appleIdentity.upsert).toHaveBeenCalledTimes(1);
  });

  it('기존 앱 토큰으로 코드를 소비하지 못하게 한다', async () => {
    await expect(linkAppleMigration(code, sourceClaims)).rejects.toMatchObject({ code: 'MIGRATION_TARGET_REQUIRED' });
    expect(redis.getdel).not.toHaveBeenCalled();
  });

  it('다른 사용자가 이미 보유한 Apple 식별자를 덮어쓰지 않는다', async () => {
    identities.set(targetClaims.sub, 'another-user');
    await expect(linkAppleMigration(code, targetClaims)).rejects.toMatchObject({ code: 'MIGRATION_IDENTITY_IN_USE' });
    expect(identities.get(targetClaims.sub)).toBe('another-user');
  });

  it('동시에 같은 코드를 요청해도 한 요청만 연결한다', async () => {
    const results = await Promise.allSettled([
      linkAppleMigration(code, targetClaims),
      linkAppleMigration(code, targetClaims),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(prisma.appleIdentity.upsert).toHaveBeenCalledTimes(1);
  });

  it('신규 가입과 계정 연결이 겹치면 연결된 기존 사용자를 반환한다', async () => {
    vi.mocked(prisma.appleIdentity.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.appleIdentity.create).mockImplementationOnce(async () => {
      identities.set(targetClaims.sub, oldUser.id);
      throw new Prisma.PrismaClientKnownRequestError('duplicate identity', { code: 'P2002', clientVersion: '5.22.0' });
    });
    await expect(upsertUserByProvider({ provider: 'APPLE', providerId: targetClaims.sub })).resolves.toMatchObject({
      isNew: false,
      user: { id: oldUser.id },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('이전 설정이 꺼져 있으면 계정을 변경하지 않는다', async () => {
    config.APPLE_MIGRATION_TARGET_BUNDLE_ID = undefined;
    await expect(linkAppleMigration(code, targetClaims)).rejects.toMatchObject({ code: 'MIGRATION_UNAVAILABLE' });
    expect(redis.getdel).not.toHaveBeenCalled();
  });

  it('Redis 장애를 잘못된 로그인으로 처리하지 않는다', async () => {
    vi.mocked(redis.getdel).mockRejectedValue(new Error('redis unavailable'));
    const app = await buildApp();
    const result = await app.inject({
      method: 'POST',
      url: '/auth/apple',
      payload: { identityToken: 'new-proof', migrationCode: code },
    });
    expect(result.statusCode).toBe(503);
    expect(prisma.appleIdentity.upsert).not.toHaveBeenCalled();
    await app.close();
  });

  it('잘못된 Apple 토큰이나 코드 형식으로는 코드를 소비하지 않는다', async () => {
    const app = await buildApp();
    const badToken = await app.inject({
      method: 'POST',
      url: '/auth/apple',
      payload: { identityToken: 'invalid', migrationCode: code },
    });
    expect(badToken.statusCode).toBe(401);
    const badCode = await app.inject({
      method: 'POST',
      url: '/auth/apple',
      payload: { identityToken: 'new-proof', migrationCode: 'bad-code' },
    });
    expect(badCode.statusCode).toBe(400);
    expect(redis.getdel).not.toHaveBeenCalled();
    await app.close();
  });
});
