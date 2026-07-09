import { useMutation } from '@tanstack/react-query';
import { apiDelete } from '@/shared/api';
import { useAuthStore } from '@/shared/model';

export function useDeleteMe() {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await apiDelete('/me');
      await useAuthStore.getState().clearAuth();
    },
  });
}
