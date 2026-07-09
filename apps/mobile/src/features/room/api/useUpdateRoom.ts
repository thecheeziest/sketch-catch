import { useMutation } from '@tanstack/react-query';
import { apiPatch } from '@/shared/api';
import type { RoomState, Category } from '@sketch-catch/shared';

type UpdateRoomInput = {
  title?: string;
  locked?: boolean;
  playerCountMax?: number;
  roundCount?: number;
  drawTimer?: number;
  categories?: Category[];
};

export function useUpdateRoom(code: string) {
  return useMutation({
    mutationFn: (data: UpdateRoomInput) => apiPatch<RoomState>(`/rooms/${code}`, data),
  });
}
