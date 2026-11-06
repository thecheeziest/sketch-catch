import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiDelete } from '@/shared/api';
import { moderationQueryKeys } from './queryKeys';

export function useUnblockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetId: string) => apiDelete(`/blocks/${targetId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: moderationQueryKeys.blocks });
    },
  });
}
