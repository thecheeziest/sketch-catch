import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiDelete } from '@/shared/api';
import { friendsQueryKeys } from './queryKeys';

export function useDeleteFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (friendUserId: string) => apiDelete(`/friends/${friendUserId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: friendsQueryKeys.all });
    },
  });
}
