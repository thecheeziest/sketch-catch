import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { apiPost } from '@/shared/api';
import type { Category } from '@sketch-catch/shared';

// D-04: 기본값 — 인원 6, 라운드 3, 타이머 30
type CreateRoomInput = {
  mode: 1 | 2;
  playerCountMax: number;
  roundCount: number;
  drawTimer: number;
  categories: Category[];
  title?: string;
  locked?: boolean;
  password?: string;
};

export function useCreateRoom() {
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: (input: CreateRoomInput) => apiPost<{ code: string }>('/rooms', input),
    onSuccess: ({ code }) => {
      // 방 만들기·입장 화면이 대기실 아래 스택에 남지 않도록 교체한다 (대기실 뒤로가기 → 홈)
      router.replace(`/room/${code}`);
    },
  });

  // 버튼 연타로 mutate가 재진입하면 방이 여러 번 생성되고 /room/[code]가 중복으로 쌓인다.
  const mutate: typeof mutation.mutate = (...args) => {
    if (mutation.isPending) return;
    mutation.mutate(...args);
  };

  return { ...mutation, mutate };
}
