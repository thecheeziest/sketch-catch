import { describe, it, expect } from 'vitest';

// 이 파일은 Plan 07 (모바일 인증 인프라)에서 실제 구현 테스트로 채워진다.
// 커버 대상: AUTH-05 (SecureStore hydration), D-06 (401 자동 로그아웃)

describe('auth store', () => {
  it.todo('initial state has isLoaded=false and isAuthenticated=false');
  it.todo('hydrateAuthStore reads tokens from SecureStore and sets isAuthenticated=true if access exists');
  it.todo('setTokens persists access (and refresh if provided) to SecureStore');
  it.todo('clearAuth deletes both SecureStore keys and resets state');
  it.todo('AUTH-05: hydration with both tokens missing leaves isAuthenticated=false');

  it('placeholder — replaced in Plan 07', () => {
    expect(true).toBe(true);
  });
});
