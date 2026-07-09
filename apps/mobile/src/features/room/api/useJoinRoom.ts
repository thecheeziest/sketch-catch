import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { apiGet } from '@/shared/api';
import type { RoomState } from '@sketch-catch/shared';

type JoinRoomInput = { code: string; password?: string };

export function useJoinRoom() {
  const router = useRouter();

  return useMutation({
    mutationFn: ({ code, password }: JoinRoomInput) => {
      const url = password
        ? `/rooms/${code}?password=${encodeURIComponent(password)}`
        : `/rooms/${code}`;
      return apiGet<RoomState>(url);
    },
    onSuccess: (_state, { code }) => {
      router.push(`/room/${code}`);
    },
    // 에러(ROOM_NOT_FOUND / ROOM_FULL / ROOM_LOCKED / WRONG_PASSWORD)는 호출부에서 ApiError.code로 분기
  });
}
