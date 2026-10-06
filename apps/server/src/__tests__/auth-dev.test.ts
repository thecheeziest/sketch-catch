import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';

const mockEnv = vi.hoisted(() => ({ NODE_ENV: 'development', ENABLE_DEV_LOGIN: true }));

vi.mock('../lib/env.js', () => ({ env: mockEnv }));
vi.mock('../lib/logger.js', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('../auth/kakao.js', () => ({ verifyKakaoToken: vi.fn() }));
vi.mock('../auth/apple.js', () => ({ verifyAppleToken: vi.fn() }));
vi.mock('../auth/jwt.js', () => ({
  signTokens: vi.fn().mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' }),
  verifyRefreshToken: vi.fn(),
  verifyAccessToken: vi.fn(),
}));
vi.mock('../db/redis.js', () => ({
  redis: { set: vi.fn().mockResolvedValue('OK'), del: vi.fn(), get: vi.fn() },
}));
vi.mock('../services/user.service.js', () => ({ upsertUserByProvider: vi.fn() }));

const { upsertUserByProvider } = await import('../services/user.service.js');
const { authRoutes } = await import('../routes/auth.js');

const devUser = {
  id: 'dev-u1',
  provider: 'KAKAO' as const,
  providerId: 'dev:1',
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

describe('POST /auth/dev', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.NODE_ENV = 'development';
    mockEnv.ENABLE_DEV_LOGIN = true;
  });

  it('개발 환경 + 플래그 on이면 테스트 계정으로 로그인한다', async () => {
    vi.mocked(upsertUserByProvider).mockResolvedValue({ user: devUser, isNew: true });

    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/auth/dev', payload: { slot: 1 } });

    expect(res.statusCode).toBe(200);
    expect(upsertUserByProvider).toHaveBeenCalledWith({ provider: 'KAKAO', providerId: 'dev:1' });
    expect(res.json()).toMatchObject({ accessToken: 'at', refreshToken: 'rt', needsOnboarding: true });
  });

  it('범위를 벗어난 slot은 400', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/auth/dev', payload: { slot: 5 } });
    expect(res.statusCode).toBe(400);
  });

  it('플래그 off면 라우트가 없다', async () => {
    mockEnv.ENABLE_DEV_LOGIN = false;
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/auth/dev', payload: { slot: 1 } });
    expect(res.statusCode).toBe(404);
  });

  it('production이면 플래그가 on이어도 라우트가 없다', async () => {
    mockEnv.NODE_ENV = 'production';
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/auth/dev', payload: { slot: 1 } });
    expect(res.statusCode).toBe(404);
  });
});
