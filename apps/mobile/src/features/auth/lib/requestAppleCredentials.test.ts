import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appleLoginSchema } from '@sketch-catch/shared';
import appleAuth from '@invertase/react-native-apple-authentication';
import { requestAppleCredentials } from './requestAppleCredentials';

vi.mock('@invertase/react-native-apple-authentication', () => ({
  default: { performRequest: vi.fn(), Operation: { LOGIN: 1 }, Scope: { FULL_NAME: 0, EMAIL: 1 } },
}));

beforeEach(() => vi.resetAllMocks());

describe('Apple 로그인 자격 확인', () => {
  it('재로그인에서 이름이 없어도 서버가 허용하는 요청을 만든다', async () => {
    vi.mocked(appleAuth.performRequest).mockResolvedValue({ identityToken: 'signed-proof', fullName: null } as Awaited<
      ReturnType<typeof appleAuth.performRequest>
    >);
    const result = await requestAppleCredentials();
    expect(appleLoginSchema.safeParse(result).success).toBe(true);
    expect(result).toEqual({ identityToken: 'signed-proof', fullName: undefined });
  });

  it('최초 로그인에서 이름 일부가 null인 경우도 서버 형식에 맞춘다', async () => {
    vi.mocked(appleAuth.performRequest).mockResolvedValue({
      identityToken: 'signed-proof',
      fullName: { familyName: null, givenName: '테스터' },
    } as Awaited<ReturnType<typeof appleAuth.performRequest>>);
    expect(appleLoginSchema.safeParse(await requestAppleCredentials()).success).toBe(true);
  });

  it('Apple에서 토큰이 오지 않으면 서버에 전달할 자격을 생성하지 않는다', async () => {
    vi.mocked(appleAuth.performRequest).mockResolvedValue({ identityToken: null, fullName: null } as Awaited<
      ReturnType<typeof appleAuth.performRequest>
    >);
    await expect(requestAppleCredentials()).rejects.toThrow('Apple identityToken');
  });
});
