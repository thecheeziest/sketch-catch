import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost, ApiError } from '@/shared/api';
import { useAuthStore, type UserPrivate } from '@/shared/model';
import { ME_QUERY_KEY } from './useMe';

export type OnboardInput = {
  nickname: string;
  friendCode: string;
  characterId: string;
};

export function useOnboard() {
  const qc = useQueryClient();

  return useMutation<UserPrivate, ApiError, OnboardInput>({
    mutationFn: (input) => apiPost<UserPrivate>('/me/onboard', input),
    onSuccess: (user) => {
      useAuthStore.getState().setUser(user);
      qc.setQueryData(ME_QUERY_KEY, user);
    },
  });
}
