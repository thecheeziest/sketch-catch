import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { apiGet } from '@/shared/api/client';
import type { RoomState } from '@sketch-catch/shared';

export function useJoinRoom() {
  const router = useRouter();

  return useMutation({
    mutationFn: (code: string) => apiGet<RoomState>(`/rooms/${code}`),
    onSuccess: (_state, code) => {
      router.push(`/room/${code}`);
    },
    // 에러(ROOM_NOT_FOUND / ROOM_FULL / ROOM_LOCKED)는 호출부에서 ApiError.code로 분기
  });
}
