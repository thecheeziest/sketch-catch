import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch } from '@/services/api';
import { ApiError } from '@/services/api';
import { useAuthStore, type UserPrivate } from '@/stores/auth';
import { ME_QUERY_KEY } from './useMe';

export type UpdateMeInput = {
  nickname?: string;
  friendCode?: string;
  characterId?: string;
};

export function useUpdateMe() {
  const qc = useQueryClient();

  return useMutation<UserPrivate, ApiError, UpdateMeInput>({
    mutationFn: (input) => apiPatch<UserPrivate>('/me', input),
    onSuccess: (user) => {
      useAuthStore.getState().setUser(user);
      qc.setQueryData(ME_QUERY_KEY, user);
    },
  });
}
