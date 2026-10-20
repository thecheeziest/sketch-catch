import { useMutation } from '@tanstack/react-query';
import { apiPatch } from '@/shared/api';
import type { RoomState, Category, RoomPenalty } from '@sketch-catch/shared';

type UpdateRoomInput = {
  title?: string;
  locked?: boolean;
  password?: string; // 이미 잠긴 방은 생략하면 기존 비밀번호 유지
  playerCountMax?: number;
  roundCount?: number;
  drawTimer?: number;
  categories?: Category[];
  penalty?: RoomPenalty | null; // null = 벌칙 끄기
};

export function useUpdateRoom(code: string) {
  return useMutation({
    mutationFn: (data: UpdateRoomInput) => apiPatch<RoomState>(`/rooms/${code}`, data),
  });
}
