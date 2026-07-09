import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch } from '@/shared/api';
import { friendsQueryKeys } from './queryKeys';

type Variables = { requestId: string; action: 'ACCEPT' | 'REJECT' };

export function useRespondRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, action }: Variables) =>
      apiPatch(`/friends/requests/${requestId}`, { action }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: friendsQueryKeys.requests });
      void queryClient.invalidateQueries({ queryKey: friendsQueryKeys.all });
    },
  });
}
