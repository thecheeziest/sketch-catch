import { useAuthStore } from '@/shared/model';

// 토큰만으로는 로그인으로 보지 않는다 — 서버 장애로 /me를 못 받으면 user 없이 보호 화면이 열리기 때문.
// 토큰은 지우지 않으므로 서버가 복구되면 다음 실행에서 자동 로그인된다.
export function useIsSignedIn(): boolean {
  return useAuthStore(s => s.isAuthenticated && !s.needsOnboarding && s.user !== null);
}
