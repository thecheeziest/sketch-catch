import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { CLIENT_EVENT } from '@sketch-catch/shared';
import { useAuthStore, useRoomStore } from '@/shared/model';
import { usePushStore } from '../../model/usePushStore';
import { InviteEntryDialog } from '../InviteEntryDialog';

type Props = {
  // 스플래시가 끝나고 로그인(온보딩 포함)이 완료된 뒤에만 초대 확인을 띄운다 — 콜드 스타트 시 스플래시에 가려지지 않게
  ready: boolean;
};

type RoomPlace = 'none' | 'lobby' | 'game';

// 시상식에서 [한번 더!]로 대기실에 온 유저는 대기실, 그 외 방 안은 게임(시상식 포함)으로 본다 — 서버 presence와 같은 기준
function useRoomPlace(): RoomPlace {
  return useRoomStore(s => {
    if (s.roomCode === null) return 'none';
    const state = s.roomState;
    if (!state) return 'lobby';
    if (state.status === 'LOBBY') return 'lobby';
    const myId = useAuthStore.getState().user?.id;
    const me = state.players.find(p => p.id === myId);
    return state.status === 'AWARD' && me?.inAward !== true ? 'lobby' : 'game';
  });
}

/**
 * 게임 초대·친구 푸시를 눌렀을 때(초대는 인앱 수신 포함) 현재 위치에 맞춰 처리한다.
 * - 방 밖: 초대는 입장 확인(InviteEntryDialog), 친구는 친구 화면으로 이동
 * - 대기실: 나가기 확인 후 대기실을 나가고 이어서 처리, 취소하면 그대로 대기실 유지
 * - 게임 중(시상식 포함): 아무것도 하지 않고 게임을 이어 간다
 * 백그라운드 복귀 직후 방 재동기화가 끝날 때까지 기다린다 — 그사이 방이 사라졌으면 방 밖 기준으로 처리된다.
 */
export function NotificationGate({ ready }: Props) {
  const pendingInviteRoomCode = usePushStore(s => s.pendingInviteRoomCode);
  const pendingFriendsNav = usePushStore(s => s.pendingFriendsNav);
  const isResyncing = useRoomStore(s => s.isResyncing);
  const currentRoomCode = useRoomStore(s => s.roomCode);
  const place = useRoomPlace();
  const isAlertOpenRef = useRef(false);
  const canHandle = ready && !isResyncing;
  const hasPending = pendingInviteRoomCode !== null || pendingFriendsNav;

  // 이미 초대된 방에 있으면 물어볼 것이 없다
  useEffect(() => {
    if (pendingInviteRoomCode !== null && pendingInviteRoomCode === currentRoomCode) {
      usePushStore.getState().setPendingInvite(null);
    }
  }, [pendingInviteRoomCode, currentRoomCode]);

  useEffect(() => {
    if (!canHandle || !hasPending || place === 'none') return;
    if (pendingInviteRoomCode !== null && pendingInviteRoomCode === currentRoomCode) return;
    const { setPendingInvite, setPendingFriendsNav } = usePushStore.getState();
    const clearPending = (): void => {
      setPendingInvite(null);
      setPendingFriendsNav(false);
    };

    if (place === 'game') {
      clearPending();
      return;
    }
    if (isAlertOpenRef.current) return;
    isAlertOpenRef.current = true;
    const message =
      pendingInviteRoomCode !== null
        ? '대기실에서 나가고 초대를 확인할까요?'
        : '대기실에서 나가고 친구 화면으로 이동할까요?';
    Alert.alert(
      '대기실 나가기',
      message,
      [
        {
          text: '취소',
          style: 'cancel',
          onPress: () => {
            isAlertOpenRef.current = false;
            clearPending();
          },
        },
        {
          text: '나가기',
          style: 'destructive',
          onPress: () => {
            isAlertOpenRef.current = false;
            useRoomStore.getState().socket?.emit(CLIENT_EVENT.ROOM_LEAVE);
            // 방 화면을 벗어나면 방 소켓이 정리되어 방 밖 기준으로 남은 초대·친구 이동이 처리된다
            router.replace('/(tabs)/' as never);
          },
        },
      ],
      { cancelable: false },
    );
  }, [canHandle, hasPending, place, pendingInviteRoomCode, currentRoomCode]);

  // 방 밖 친구 푸시 — 바로 친구 화면으로
  useEffect(() => {
    if (!canHandle || !pendingFriendsNav || place !== 'none') return;
    usePushStore.getState().setPendingFriendsNav(false);
    router.push('/(tabs)/friends' as never);
  }, [canHandle, pendingFriendsNav, place]);

  const clearInvite = (): void => {
    usePushStore.getState().setPendingInvite(null);
  };

  const enterRoom = (code: string): void => {
    router.push(`/room/${code}` as never);
    clearInvite();
  };

  return (
    <InviteEntryDialog
      roomCode={canHandle && place === 'none' ? pendingInviteRoomCode : null}
      onEnter={enterRoom}
      onClose={clearInvite}
    />
  );
}
