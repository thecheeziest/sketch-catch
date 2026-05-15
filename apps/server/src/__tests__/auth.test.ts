import { describe, it, expect } from 'vitest';

// 이 파일은 Plan 04 (auth 라우트)에서 실제 구현 테스트로 채워진다.
// 커버 대상: AUTH-01 (카카오), AUTH-02 (애플), AUTH-04 (닉네임+코드 조합 유니크), D-05 (단일 세션)

describe('auth routes', () => {
  it.todo('POST /auth/kakao verifies idToken via JWKS and returns AuthSuccessResponse');
  it.todo('POST /auth/apple verifies identityToken and returns AuthSuccessResponse (iOS only)');
  it.todo('POST /auth/refresh returns new accessToken when refreshToken is valid');
  it.todo('POST /auth/logout clears Redis session');
  it.todo('AUTH-04: same nickname+code combination upsert returns 409 NICKNAME_CODE_CONFLICT');
  it.todo('D-05: new device login overwrites Redis session, old token returns 401 SESSION_REPLACED');

  it('placeholder — replaced in Plan 04', () => {
    expect(true).toBe(true);
  });
});
