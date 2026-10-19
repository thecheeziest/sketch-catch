import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';

const mockEnv = vi.hoisted(() => ({
  MIN_BUILD_IOS: 5 as number | undefined,
  MIN_BUILD_ANDROID: undefined as number | undefined,
  APP_UPDATE_URL_IOS: 'https://testflight.apple.com/join/TEST' as string | undefined,
  APP_UPDATE_URL_ANDROID: undefined as string | undefined,
}));

vi.mock('../lib/env.js', () => ({ env: mockEnv }));

const { isOutdatedClient } = await import('../lib/appVersion.js');
const { appVersionRoutes } = await import('../routes/appVersion.js');

describe('강제 업데이트', () => {
  beforeEach(() => {
    mockEnv.MIN_BUILD_IOS = 5;
    mockEnv.MIN_BUILD_ANDROID = undefined;
  });

  describe('isOutdatedClient', () => {
    it('최소 빌드보다 낮으면 차단한다 (헤더 문자열·소켓 숫자 모두)', () => {
      expect(isOutdatedClient('ios', '4')).toBe(true);
      expect(isOutdatedClient('ios', 4)).toBe(true);
    });

    it('최소 빌드 이상이면 통과한다', () => {
      expect(isOutdatedClient('ios', '5')).toBe(false);
      expect(isOutdatedClient('ios', '6')).toBe(false);
    });

    it('최소 빌드가 설정되지 않은 플랫폼은 통과한다', () => {
      expect(isOutdatedClient('android', '1')).toBe(false);
    });

    it('플랫폼·빌드를 보내지 않는 기존 클라이언트는 통과한다', () => {
      expect(isOutdatedClient(undefined, undefined)).toBe(false);
      expect(isOutdatedClient('ios', undefined)).toBe(false);
      expect(isOutdatedClient('web', '1')).toBe(false);
    });

    it('숫자가 아닌 빌드 값은 차단하지 않는다', () => {
      expect(isOutdatedClient('ios', 'abc')).toBe(false);
    });
  });

  describe('GET /app/version', () => {
    async function buildApp() {
      const app = Fastify();
      await app.register(appVersionRoutes);
      return app;
    }

    it('플랫폼별 최소 빌드와 업데이트 링크를 반환한다', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/app/version?platform=ios' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ minBuild: 5, updateUrl: 'https://testflight.apple.com/join/TEST' });
    });

    it('미설정 플랫폼은 null을 반환한다', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/app/version?platform=android' });
      expect(res.json()).toEqual({ minBuild: null, updateUrl: null });
    });

    it('잘못된 플랫폼은 400', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/app/version?platform=web' });
      expect(res.statusCode).toBe(400);
    });
  });
});
