import { useMutation } from '@tanstack/react-query';
import appleAuth from '@invertase/react-native-apple-authentication';
import { apiPost } from '@/shared/api';
import { initializeAuthState } from '@/shared/lib';
import type { UserPrivate } from '@/shared/model';

type AppleAuthResponse = {
  accessToken: string;
  refreshToken: string;
  needsOnboarding: boolean;
  user: UserPrivate;
};

export function useAppleLogin() {
  return useMutation({
    mutationFn: async () => {
      const res = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });

      if (!res.identityToken) {
        throw new Error('Apple identityToken을 받지 못했습니다');
      }

      // Pitfall 4: fullName은 최초 로그인 시에만 존재, 이후 null 반환 (Apple OAuth 정책)
      const fullName = res.fullName
        ? {
            familyName: res.fullName.familyName ?? undefined,
            givenName: res.fullName.givenName ?? undefined,
          }
        : undefined;

      const data = await apiPost<AppleAuthResponse>('/auth/apple', {
        identityToken: res.identityToken,
        fullName,
      });

      return initializeAuthState(data);
    },
  });
}
