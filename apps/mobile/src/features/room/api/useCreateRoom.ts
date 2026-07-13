import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { apiPost } from '@/shared/api';
import type { Category } from '@sketch-catch/shared';

// D-04: 기본값 — 인원 6, 라운드 5, 타이머 30
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

  return useMutation({
    mutationFn: (input: CreateRoomInput) => apiPost<{ code: string }>('/rooms', input),
    onSuccess: ({ code }) => {
      router.push(`/room/${code}`);
    },
  });
}
