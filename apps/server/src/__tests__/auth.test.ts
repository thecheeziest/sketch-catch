import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';

// mocks
vi.mock('../auth/kakao.js', () => ({
  verifyKakaoToken: vi.fn(),
}));
vi.mock('../auth/apple.js', () => ({
  verifyAppleToken: vi.fn(),
}));
vi.mock('../db/redis.js', () => ({
  redis: {
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    get: vi.fn(),
  },
}));
vi.mock('../services/user.service.js', () => ({
  upsertUserByProvider: vi.fn(),
}));

const { verifyKakaoToken } = await import('../auth/kakao.js');
const { redis } = await import('../db/redis.js');
const { upsertUserByProvider } = await import('../services/user.service.js');
const { authRoutes } = await import('../routes/auth.js');

const sampleUser = {
  id: 'u1',
  provider: 'KAKAO' as const,
  providerId: 'kakao-123',
  nickname: '손님12345',
  friendCode: 'ABCDE',
  characterId: 'dog',
  pushToken: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  nicknameChangedAt: null,
};

async function buildApp() {
  const app = Fastify();
  await app.register(authRoutes);
  return app;
}

describe('POST /auth/kakao', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns AuthSuccessResponse for valid idToken', async () => {
    vi.mocked(verifyKakaoToken).mockResolvedValue({ sub: 'kakao-123' });
    vi.mocked(upsertUserByProvider).mockResolvedValue({ user: sampleUser, isNew: true });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/kakao',
      payload: { idToken: 'valid-token' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.needsOnboarding).toBe(true);
    expect(body.user.nickname).toBe('손님12345');
    // D-05 단일 기기: redis.set(session:userId) 호출
    expect(redis.set).toHaveBeenCalledWith('session:u1', expect.any(String));
  });

  it('returns 401 INVALID_TOKEN for invalid idToken', async () => {
    vi.mocked(verifyKakaoToken).mockRejectedValue(new Error('JWSInvalid'));
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/kakao',
      payload: { idToken: 'invalid' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('INVALID_TOKEN');
  });

  it('returns 400 when body is malformed', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/kakao',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /auth/refresh', () => {
  it('returns new accessToken for valid refreshToken', async () => {
    // signTokens는 실제 jose 사용 — 실 토큰 생성 후 verify
    const { signTokens } = await import('../auth/jwt.js');
    const { refreshToken } = await signTokens('user-1');
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeDefined();
  });

  it('returns 401 for invalid refreshToken', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: 'invalid' },
    });
    expect(res.statusCode).toBe(401);
  });
});
