import { useEffect } from 'react';
import { useRoomStore } from '@/shared/model';

export function useMatchingTimer(): void {
  const isMatchmaking = useRoomStore((s) => s.isMatchmaking);

  useEffect(() => {
    if (!isMatchmaking) return;
    const id = setInterval(() => {
      const cur = useRoomStore.getState().matchingSeconds;
      useRoomStore.getState().setMatchingSeconds(cur + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [isMatchmaking]);
}
