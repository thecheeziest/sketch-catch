import { useMutation } from '@tanstack/react-query';
import { Platform } from 'react-native';
import type { DeleteMeInput } from '@sketch-catch/shared';
import { apiDelete } from '@/shared/api';
import { useAuthStore } from '@/shared/model';
import { requestAppleAuthorizationCode } from '@/features/auth/lib/requestAppleCredentials';

export function useDeleteMe() {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const body: DeleteMeInput = {};
      // Apple 로그인 계정은 Apple 연결 해제를 위해 한 번 더 인증한다 (취소하면 탈퇴도 진행하지 않는다)
      if (Platform.OS === 'ios' && useAuthStore.getState().user?.provider === 'APPLE') {
        body.appleAuthorizationCode = await requestAppleAuthorizationCode();
      }
      await apiDelete('/me', body);
      await useAuthStore.getState().clearAuth();
    },
  });
}
