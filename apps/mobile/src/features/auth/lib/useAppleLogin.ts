import { useMutation } from '@tanstack/react-query';
import appleAuth from '@invertase/react-native-apple-authentication';
import { apiPost } from '@/shared/api';
import { initializeAuthState } from '@/shared/lib';
import type { UserPrivate } from '@/shared/model';
import { requestAppleCredentials } from './requestAppleCredentials';

type AppleAuthResponse = {
  accessToken: string;
  refreshToken: string;
  needsOnboarding: boolean;
  user: UserPrivate;
};

// 사용자가 Apple 로그인 시트를 직접 닫은 경우 — 에러 안내 대상이 아니다
export function isAppleLoginCanceled(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === appleAuth.Error.CANCELED;
}

export function useAppleLogin() {
  return useMutation({
    retry: false,
    mutationFn: async (migrationCode?: string) => {
      const credentials = await requestAppleCredentials();
      const data = await apiPost<AppleAuthResponse>('/auth/apple', {
        ...credentials,
        ...(migrationCode ? { migrationCode } : {}),
      });

      return initializeAuthState(data);
    },
  });
}
