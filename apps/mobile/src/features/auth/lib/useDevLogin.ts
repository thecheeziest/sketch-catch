import { useMutation } from '@tanstack/react-query';
import { apiPost } from '@/shared/api';
import { initializeAuthState } from '@/shared/lib';
import type { UserPrivate } from '@/shared/model';

type DevAuthResponse = {
  accessToken: string;
  refreshToken: string;
  needsOnboarding: boolean;
  user: UserPrivate;
};

// 개발 빌드 전용 — 서버 POST /auth/dev(ENABLE_DEV_LOGIN, 비 production)와 짝을 이룬다
export const DEV_TEST_SLOTS = [1, 2, 3, 4] as const;

export function useDevLogin() {
  return useMutation({
    mutationFn: async (slot: (typeof DEV_TEST_SLOTS)[number]) => {
      const data = await apiPost<DevAuthResponse>('/auth/dev', { slot });
      return initializeAuthState(data);
    },
  });
}
