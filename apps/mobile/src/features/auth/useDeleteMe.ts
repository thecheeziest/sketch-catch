import { useMutation } from '@tanstack/react-query';
import { apiDelete } from '@/services/api';
import { useAuthStore } from '@/stores/auth';

export function useDeleteMe() {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await apiDelete('/me');
      await useAuthStore.getState().clearAuth();
    },
  });
}
