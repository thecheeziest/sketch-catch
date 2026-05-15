import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/shared/api/client';

// D-04: target은 "닉네임#코드" 전체 조합 (코드만으로 단일 특정 불가)
export function useSendFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (target: string) => apiPost('/friends/requests', { target }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['friends', 'requests'] });
    },
  });
}
