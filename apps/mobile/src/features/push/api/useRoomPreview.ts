import { useQuery } from '@tanstack/react-query';
import { apiGet, ApiError } from '@/shared/api';
import type { RoomPreview } from '@sketch-catch/shared';

// 초대 푸시를 눌렀을 때 입장 확인 전 방 제목·상태 조회 — 방 상태는 금방 바뀌므로 캐시하지 않는다
export function useRoomPreview(code: string | null) {
  return useQuery<RoomPreview, ApiError>({
    queryKey: ['rooms', code, 'preview'],
    queryFn: () => apiGet<RoomPreview>(`/rooms/${code}/preview`),
    enabled: code !== null,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
}
