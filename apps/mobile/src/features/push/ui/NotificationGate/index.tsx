import { Text } from 'dripsy';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useRoomStore } from '@/shared/model';
import { Dialog } from '@/shared/ui';
import { usePushStore } from '../../model/usePushStore';
import { InviteEntryDialog } from '../InviteEntryDialog';

type Props = {
  // 스플래시가 끝나고 로그인(온보딩 포함)이 완료된 뒤에만 초대 확인을 띄운다 — 콜드 스타트 시 스플래시에 가려지지 않게
  ready: boolean;
};

// 게임 초대 푸시를 눌렀을 때 — 방에 없으면 입장 확인(InviteEntryDialog), 다른 방에 있으면 D-11 이동 확인
export function NotificationGate({ ready }: Props) {
  const pendingInviteRoomCode = usePushStore((s) => s.pendingInviteRoomCode);
  const currentRoomCode = useRoomStore((s) => s.roomState?.code ?? null);
  const inviteCode = ready ? pendingInviteRoomCode : null;
  const isSameRoom = inviteCode !== null && inviteCode === currentRoomCode;

  const clearPending = () => {
    usePushStore.getState().setPendingInvite(null);
  };

  // 이미 초대된 방에 있으면 물어볼 것이 없다
  useEffect(() => {
    if (isSameRoom) usePushStore.getState().setPendingInvite(null);
  }, [isSameRoom]);

  const enterRoom = (code: string) => {
    router.push(`/room/${code}` as never);
    clearPending();
  };

  const confirmSwitch = () => {
    const code = pendingInviteRoomCode;
    if (!code) return;
    // 이전 방 소켓은 새 방 연결(connect) 시 끊기고, 서버는 끊김을 퇴장으로 처리한다.
    router.replace(`/room/${code}` as never);
    clearPending();
  };

  const isInOtherRoom = currentRoomCode !== null && !isSameRoom;

  return (
    <>
      <InviteEntryDialog
        roomCode={inviteCode !== null && currentRoomCode === null ? inviteCode : null}
        onEnter={enterRoom}
        onClose={clearPending}
      />
      <Dialog
        visible={inviteCode !== null && isInOtherRoom}
        onClose={clearPending}
        title="방을 이동할까요?"
        buttons={[
          { label: '취소', color: 'light', onPress: clearPending },
          { label: '이동하기', color: 'primary', onPress: confirmSwitch },
        ]}
      >
        <Text>현재 방에서 나가고 초대된 방으로 이동할까요?</Text>
      </Dialog>
    </>
  );
}
