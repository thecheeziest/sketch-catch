import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/shared/api';
import { friendsQueryKeys } from '@/features/friends/api/queryKeys';
import { moderationQueryKeys } from './queryKeys';

// 차단하면 서버가 친구 관계·대기 중 요청도 정리하므로 친구 목록도 새로 받는다
export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetId: string) => apiPost('/blocks', { targetId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: moderationQueryKeys.blocks });
      void queryClient.invalidateQueries({ queryKey: friendsQueryKeys.all });
    },
  });
}
