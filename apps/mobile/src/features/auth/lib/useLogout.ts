import { useCallback } from 'react';
import { logout as kakaoLogout } from '@react-native-seoul/kakao-login';
import { apiPost, queryClient } from '@/shared/api';
import { useAuthStore } from '@/shared/model';

export function useLogout() {
  return useCallback(async () => {
    // 서버 세션 삭제 (실패해도 계속 진행)
    try {
      await apiPost('/auth/logout');
    } catch {
      // ignore — 이미 만료된 세션이거나 네트워크 오류
    }

    // 카카오 로컬 세션 해제 (실패해도 계속 진행)
    try {
      await kakaoLogout();
    } catch {
      // ignore — 이미 로그아웃 상태이거나 카카오 SDK 오류
    }

    // SecureStore 토큰 삭제 + Zustand 상태 초기화
    await useAuthStore.getState().clearAuth();

    // 이전 사용자의 캐시가 다음 로그인에 노출되지 않도록 전체 초기화
    queryClient.clear();
  }, []);
}
