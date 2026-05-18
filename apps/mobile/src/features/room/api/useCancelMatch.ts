import { useMutation } from '@tanstack/react-query';
import { apiDelete } from '@/shared/api/client';
import { useRoomStore } from '@/shared/model/room';

export function useCancelMatch() {
  return useMutation({
    mutationFn: () => apiDelete('/match'),
    onSettled: () => {
      // 성공/실패 모두 매칭 상태 초기화 (ROOM-04: 즉시 큐 제거)
      useRoomStore.getState().setMatchmaking(false);
    },
  });
}
