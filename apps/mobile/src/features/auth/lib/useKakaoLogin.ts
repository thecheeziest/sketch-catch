import { useMutation } from '@tanstack/react-query';
import { login as kakaoLogin } from '@react-native-seoul/kakao-login';
import { apiPost } from '@/shared/api';
import { initializeAuthState } from '@/shared/lib';
import type { UserPrivate } from '@/shared/model';

type KakaoAuthResponse = {
  accessToken: string;
  refreshToken: string;
  needsOnboarding: boolean;
  user: UserPrivate;
};

export function useKakaoLogin() {
  return useMutation({
    mutationFn: async () => {
      const result = await kakaoLogin();

      // Pitfall 3: accessToken이 아닌 idToken을 서버로 전송해야 함 (OIDC)
      if (!result.idToken) {
        throw new Error('카카오 idToken 없음 — OIDC 활성화 필요');
      }

      const data = await apiPost<KakaoAuthResponse>('/auth/kakao', {
        idToken: result.idToken,
      });

      return initializeAuthState(data);
    },
  });
}
