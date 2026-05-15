import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiDelete } from '@/shared/api/client';

export function useDeleteFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (friendUserId: string) => apiDelete(`/friends/${friendUserId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}
