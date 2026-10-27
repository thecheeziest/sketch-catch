import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('DATABASE_URL', 'postgresql://localhost/apple-auth-test');
  vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
  vi.stubEnv('APPLE_BUNDLE_ID', 'com.sketchcatch.app');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Apple 로그인 환경변수', () => {
  it('쉼표 구분 목록의 공백을 제거한다', async () => {
    vi.stubEnv('APPLE_BUNDLE_IDS', 'com.sketchcatch.app, com.sketchcatch.ios');
    const { env } = await import('../lib/env.js');
    expect(env.APPLE_BUNDLE_IDS).toEqual(['com.sketchcatch.app', 'com.sketchcatch.ios']);
  });

  it('목록이 미설정이면 기존 단일 설정을 유지한다', async () => {
    vi.stubEnv('APPLE_BUNDLE_IDS', undefined);
    const { env } = await import('../lib/env.js');
    expect(env.APPLE_BUNDLE_IDS).toBeUndefined();
    expect(env.APPLE_BUNDLE_ID).toBe('com.sketchcatch.app');
  });

  it.each(['', ',', 'com.sketchcatch.app, '])('빈 Bundle ID를 포함하는 설정 %j을 거부한다', async value => {
    vi.stubEnv('APPLE_BUNDLE_IDS', value);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('invalid environment');
    });
    await expect(import('../lib/env.js')).rejects.toThrow('invalid environment');
    expect(exit).toHaveBeenCalledWith(1);
  });
});
