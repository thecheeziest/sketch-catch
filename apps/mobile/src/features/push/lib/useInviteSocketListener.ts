import { useEffect } from 'react';
import { usePresenceStore, useRoomStore } from '@/shared/model';
import { usePushStore } from '../model/usePushStore';

// 앱을 켜 둔 상태에서 받은 초대 — 푸시 도착 여부와 상관없이 presence 소켓으로 받아 바로 입장 확인을 띄운다
export function useInviteSocketListener(): void {
  const socket = usePresenceStore(s => s.socket);

  useEffect(() => {
    if (!socket) return;
    const handleInvite = ({ roomCode }: { roomCode: string }): void => {
      // 대기실·게임 중에는 서버가 초대를 막지만, 경합으로 도착해도 지금 방을 방해하지 않는다
      if (useRoomStore.getState().roomCode !== null) return;
      usePushStore.getState().setPendingInvite(roomCode);
    };
    socket.on('invite:received', handleInvite);
    return () => {
      socket.off('invite:received', handleInvite);
    };
  }, [socket]);
}
