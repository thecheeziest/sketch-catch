import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/api';
import type { RoomListItem } from '@sketch-catch/shared';

export function useRoomList() {
  return useQuery<RoomListItem[]>({
    queryKey: ['rooms', 'list'],
    queryFn: () => apiGet<RoomListItem[]>('/rooms'),
    // 인원·게임 상태가 계속 바뀌므로 화면을 보는 동안 주기적으로 갱신
    refetchInterval: 10_000,
  });
}
