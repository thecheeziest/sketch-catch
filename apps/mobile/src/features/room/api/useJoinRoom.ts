import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { apiGet } from '@/shared/api';
import type { RoomState } from '@sketch-catch/shared';

type JoinRoomInput = { code: string; password?: string };

export function useJoinRoom() {
  const router = useRouter();

  const mutation = useMutation({
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

  // 버튼 연타로 mutate가 재진입하면 /room/[code]가 중복으로 쌓인다.
  const mutate: typeof mutation.mutate = (...args) => {
    if (mutation.isPending) return;
    mutation.mutate(...args);
  };

  return { ...mutation, mutate };
}
