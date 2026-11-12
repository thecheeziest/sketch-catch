import { generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const env = {
  APPLE_TEAM_ID: 'TEAM123456',
  APPLE_SIWA_CLIENT_ID: 'com.sketchcatch.ios',
  APPLE_SIWA_KEY_ID: 'KEY1234567' as string | undefined,
  APPLE_SIWA_PRIVATE_KEY: pem as string | undefined,
};
vi.mock('../lib/env.js', () => ({ env }));
vi.mock('../lib/logger.js', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const { revokeAppleAuthorization } = await import('../auth/appleRevoke.js');

describe('revokeAppleAuthorization', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('authorization code를 refresh 토큰으로 바꾼 뒤 철회한다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ refresh_token: 'r1', access_token: 'a1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(revokeAppleAuthorization('code-1')).resolves.toBe(true);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://appleid.apple.com/auth/token');
    const revokeBody = new URLSearchParams(fetchMock.mock.calls[1]?.[1]?.body as URLSearchParams);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://appleid.apple.com/auth/revoke');
    expect(revokeBody.get('token')).toBe('r1');
    expect(revokeBody.get('token_type_hint')).toBe('refresh_token');
    expect(revokeBody.get('client_id')).toBe('com.sketchcatch.ios');
  });

  it('코드 교환에 실패하면 예외 없이 false를 돌려준다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{"error":"invalid_grant"}', { status: 400 })));
    await expect(revokeAppleAuthorization('bad')).resolves.toBe(false);
  });

  it('키가 설정되지 않으면 Apple에 요청하지 않는다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    env.APPLE_SIWA_KEY_ID = undefined;
    await expect(revokeAppleAuthorization('code-1')).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    env.APPLE_SIWA_KEY_ID = 'KEY1234567';
  });
});
