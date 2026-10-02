import { useEffect } from 'react';
import { useRoomStore } from '@/shared/model';

// matchLobby.deadline까지 남은 초를 1초 간격으로 갱신한다. 아직 카운트다운 시작 전(deadline null)이면 0.
export function useMatchingTimer(): void {
  const isMatchmaking = useRoomStore((s) => s.isMatchmaking);
  const deadline = useRoomStore((s) => s.matchLobby?.deadline ?? null);

  useEffect(() => {
    if (!isMatchmaking) return;

    const tick = (): void => {
      const currentDeadline = useRoomStore.getState().matchLobby?.deadline ?? null;
      const remaining = currentDeadline ? Math.max(0, Math.ceil((currentDeadline - Date.now()) / 1000)) : 0;
      useRoomStore.getState().setMatchingSeconds(remaining);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isMatchmaking, deadline]);
}
