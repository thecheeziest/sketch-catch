import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/shared/api';
import { friendsQueryKeys } from './queryKeys';

// accepted: 상대가 먼저 보낸 요청이 있어 바로 친구가 됐는지 (서로 신청)
export type SendFriendRequestResponse = { ok: true; accepted?: boolean };

// D-04: target은 "닉네임#코드" 전체 조합 (코드만으로 단일 특정 불가)
export function useSendFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (target: string) => apiPost<SendFriendRequestResponse>('/friends/requests', { target }),
    onSuccess: () => {
      // 서로 신청이면 친구 목록도 바뀐다 — 받은·보낸 요청과 친구 목록을 함께 갱신
      void queryClient.invalidateQueries({ queryKey: friendsQueryKeys.all });
    },
  });
}
