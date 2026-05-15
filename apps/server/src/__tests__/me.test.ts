import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { assertNicknameCooldown, NicknameCooldownError } from '../services/me.service.js';

// ---- assertNicknameCooldown 단위 테스트 ----

describe('assertNicknameCooldown', () => {
  it('passes when lastChange is null', () => {
    expect(() => assertNicknameCooldown(null)).not.toThrow();
  });
  it('passes when more than 30 days have passed', () => {
    const lastChange = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-02-15T00:00:00Z'); // 45일 후
    expect(() => assertNicknameCooldown(lastChange, now)).not.toThrow();
  });
  it('throws NicknameCooldownError with nextChangeAt when within 30 days', () => {
    const lastChange = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-15T00:00:00Z'); // 14일 후
    try {
      assertNicknameCooldown(lastChange, now);
      expect.fail('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(NicknameCooldownError);
      const e = err as NicknameCooldownError;
      expect(e.code).toBe('NICKNAME_CHANGE_COOLDOWN');
      expect(e.nextChangeAt).toBe('2026-01-31T00:00:00.000Z');
    }
  });
});

// ---- /me 라우트 통합 테스트 ----

vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn().mockResolvedValue({}) },
    friendRequest: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    friendship: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    gameReplay: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    $transaction: vi.fn(async (ops: unknown[]) => {
      // ops는 Promise 배열 — 각각 await
      const results = [];
      for (const op of ops) {
        results.push(await op);
      }
      return results;
    }),
  },
}));
vi.mock('../db/redis.js', () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn().mockResolvedValue(1) },
}));

const { prisma } = await import('../db/prisma.js');
const { redis } = await import('../db/redis.js');
const { signTokens } = await import('../auth/jwt.js');
const { meRoutes } = await import('../routes/me.js');

async function buildApp() {
  const app = Fastify();
  await app.register(meRoutes);
  return app;
}

const sampleUser = {
  id: 'u1',
  provider: 'KAKAO' as const,
  providerId: 'k1',
  nickname: '닉네임',
  friendCode: 'ABCDE',
  characterId: 'dog',
  pushToken: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  nicknameChangedAt: null,
};

describe('GET /me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when Authorization header missing', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns UserPrivate when token + session valid', async () => {
    const { accessToken } = await signTokens('u1');
    vi.mocked(redis.get).mockResolvedValue(accessToken);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(sampleUser as any);

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().nickname).toBe('닉네임');
  });

  it('returns 401 SESSION_REPLACED when redis session mismatches token', async () => {
    const { accessToken } = await signTokens('u1');
    vi.mocked(redis.get).mockResolvedValue('different-token');
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('SESSION_REPLACED');
  });
});

describe('PATCH /me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 429 NICKNAME_CHANGE_COOLDOWN when changing nickname within 30 days', async () => {
    const { accessToken } = await signTokens('u1');
    vi.mocked(redis.get).mockResolvedValue(accessToken);
    const recentUser = { ...sampleUser, nicknameChangedAt: new Date(Date.now() - 5 * 86_400_000) };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(recentUser as any);

    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { nickname: '새닉네임' },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe('NICKNAME_CHANGE_COOLDOWN');
    expect(res.json().nextChangeAt).toBeDefined();
  });

  it('updates characterId without cooldown check', async () => {
    const { accessToken } = await signTokens('u1');
    vi.mocked(redis.get).mockResolvedValue(accessToken);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(sampleUser as any);
    vi.mocked(prisma.user.update).mockResolvedValue({ ...sampleUser, characterId: 'cat' } as any);

    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { characterId: 'cat' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().characterId).toBe('cat');
  });
});

describe('DELETE /me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes user data and removes Redis session', async () => {
    const { accessToken } = await signTokens('u1');
    vi.mocked(redis.get).mockResolvedValue(accessToken);

    const app = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: '/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(prisma.friendRequest.deleteMany).toHaveBeenCalled();
    expect(prisma.friendship.deleteMany).toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith('session:u1');
  });
});
