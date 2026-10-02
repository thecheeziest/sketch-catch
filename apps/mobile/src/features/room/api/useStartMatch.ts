import { useMutation } from '@tanstack/react-query';
import { apiPost } from '@/shared/api';
import { useRoomStore } from '@/shared/model';

export function useStartMatch() {
  return useMutation({
    mutationFn: (mode: 1 | 2) => apiPost<void>('/match', { mode }),
    onSuccess: () => {
      // 방 배정은 카운트다운 종료 후 소켓(match:found)으로 push된다 — useMatchingNavigation이 처리
      useRoomStore.getState().setMatchmaking(true);
    },
  });
}
