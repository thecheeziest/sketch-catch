/**
 * Task 1 TDD — Tests for JWT, JWKS, and User service modules
 * JWT + JWKS 검증 모듈 + User 서비스 단위 테스트
 */
import { describe, it, expect, vi } from 'vitest';

// prisma mock (hoisted — vi.mock은 파일 상단으로 hoisting됨)
vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// ──────────────────────────────────────────
// Test 1: verifyKakaoToken — 잘못된 토큰은 throw
// ──────────────────────────────────────────
describe('verifyKakaoToken', () => {
  it('throws for invalid idToken', async () => {
    const { verifyKakaoToken } = await import('../auth/kakao.js');
    await expect(verifyKakaoToken('invalid')).rejects.toThrow();
  });
});

// ──────────────────────────────────────────
// Test 2/3/4: signTokens + verifyAccessToken + verifyRefreshToken
// ──────────────────────────────────────────
describe('signTokens + verifyAccessToken', () => {
  it('signTokens returns access and refresh tokens with correct sub', async () => {
    const { signTokens, verifyAccessToken } = await import('../auth/jwt.js');
    const { accessToken } = await signTokens('user-test-1');
    const payload = await verifyAccessToken(accessToken);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe('user-test-1');
  });

  it('verifyAccessToken returns null for token signed with wrong secret', async () => {
    const { SignJWT } = await import('jose');
    const wrongSecret = new TextEncoder().encode('wrong-secret-different-from-env');
    const badToken = await new SignJWT({ typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-bad')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(wrongSecret);

    const { verifyAccessToken } = await import('../auth/jwt.js');
    const result = await verifyAccessToken(badToken);
    expect(result).toBeNull();
  });

  it('verifyRefreshToken returns null for access token (wrong typ)', async () => {
    const { signTokens, verifyRefreshToken } = await import('../auth/jwt.js');
    const { accessToken } = await signTokens('user-test-2');
    const result = await verifyRefreshToken(accessToken);
    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────
// Test 5: ensureUniqueNicknameCode
// ──────────────────────────────────────────
describe('ensureUniqueNicknameCode', () => {
  it('throws NICKNAME_CODE_CONFLICT when combination exists', async () => {
    const { prisma } = await import('../db/prisma.js');
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: 'existing-user',
      provider: 'KAKAO',
      providerId: 'kakao-123',
      nickname: '손님12345',
      friendCode: 'ABCDE',
      characterId: 'dog',
      pushToken: null,
      createdAt: new Date(),
      nicknameChangedAt: null,
    });

    const { ensureUniqueNicknameCode } = await import('../services/user.service.js');
    await expect(
      ensureUniqueNicknameCode('손님12345', 'ABCDE'),
    ).rejects.toMatchObject({ code: 'NICKNAME_CODE_CONFLICT' });
  });

  it('resolves when no conflict found (excludeUserId works)', async () => {
    const { prisma } = await import('../db/prisma.js');
    // excludeUserId가 NOT 조건으로 들어가서 결과가 null이 되는 시나리오
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    const { ensureUniqueNicknameCode } = await import('../services/user.service.js');
    await expect(
      ensureUniqueNicknameCode('손님12345', 'ABCDE', 'same-user'),
    ).resolves.toBeUndefined();
  });
});
