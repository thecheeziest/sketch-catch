import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useRoomStore } from '@/shared/model';

export function useMatchingNavigation(): void {
  const router = useRouter();
  const roomCode = useRoomStore((s) => s.roomState?.code);

  useEffect(() => {
    if (!roomCode) return;
    if (!useRoomStore.getState().isMatchmaking) return;
    useRoomStore.getState().setMatchmaking(false);
    router.replace(`/room/${roomCode}`);
  }, [roomCode]);
}
