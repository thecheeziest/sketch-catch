import { Text } from 'dripsy';
import { CLIENT_EVENT } from '@sketch-catch/shared';
import { router } from 'expo-router';
import { Dialog } from '@/shared/ui';
import { useRoomStore } from '@/shared/model';
import { usePushStore } from '../../model/usePushStore';

// D-11: 게임 초대 푸시 클릭 시 이미 다른 방에 속해 있으면 이동 여부를 확인하는 Dialog
export function NotificationGate() {
  const pendingInviteRoomCode = usePushStore((s) => s.pendingInviteRoomCode);

  const clearPending = () => {
    usePushStore.getState().setPendingInvite(null);
  };

  const confirmSwitch = () => {
    const code = pendingInviteRoomCode;
    if (!code) return;
    const socket = useRoomStore.getState().socket;
    socket?.emit(CLIENT_EVENT.ROOM_LEAVE);
    socket?.emit(CLIENT_EVENT.ROOM_JOIN, { code });
    router.push(`/room/${code}` as never);
    clearPending();
  };

  return (
    <Dialog
      visible={!!pendingInviteRoomCode}
      onClose={clearPending}
      title="방을 이동할까요?"
      buttons={[
        { label: '취소', color: 'light', onPress: clearPending },
        { label: '이동하기', color: 'primary', onPress: confirmSwitch },
      ]}
    >
      <Text>현재 방에서 나가고 초대된 방으로 이동할까요?</Text>
    </Dialog>
  );
}
