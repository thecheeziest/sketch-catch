import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { CLIENT_EVENT, isGameInProgressStatus, type RoomState } from '@sketch-catch/shared';
import { handleApiError } from '@/shared/lib';
import { useAuthStore, useRoomStore, useToastStore } from '@/shared/model';
import { useBlockUser } from '../api';
import { type ModerationTarget, useReportStore } from '../model';

const BLOCK_EFFECT_MESSAGE = '서로 같은 방에 들어갈 수 없고 친구 관계가 끊겨요.\n설정에서 언제든 풀 수 있어요.';

// 차단할 상대와 지금 같은 방에 있으면, 차단과 함께 내가 있는 곳(대기실·게임·시상식)에서 나간다
function getLeaveNotice(roomState: RoomState | null, myId: string | undefined, targetId: string): string | null {
  if (!roomState || !myId) return null;
  const members = [...roomState.players, ...(roomState.awardViewers ?? [])];
  if (!members.some(member => member.id === targetId && !member.left)) return null;

  const me = roomState.players.find(player => player.id === myId);
  const isWatchingAward = me?.inAward === true || roomState.awardViewers?.some(viewer => viewer.id === myId);
  if (isWatchingAward) return '차단하면 지금 있는 시상식에서 나가져요.';
  if (isGameInProgressStatus(roomState.status)) {
    return '차단하면 지금 하는 게임에서 바로 나가져요.\n다시 들어올 수 없고 패배 처리돼요.';
  }
  return '차단하면 지금 있는 대기실에서 나가져요.';
}

// 차단 확인 → 차단, 신고 사유 선택 열기, 채팅 길게 누르기 메뉴를 한곳에서 처리한다
export function useUserModeration() {
  const router = useRouter();
  const { mutate: block } = useBlockUser();
  const openReport = useReportStore(s => s.open);

  const confirmBlock = useCallback(
    (target: ModerationTarget): void => {
      const { roomState, socket } = useRoomStore.getState();
      const leaveNotice = getLeaveNotice(roomState, useAuthStore.getState().user?.id, target.userId);
      const message = leaveNotice ? `${leaveNotice}\n\n${BLOCK_EFFECT_MESSAGE}` : BLOCK_EFFECT_MESSAGE;

      const handleBlocked = (): void => {
        useToastStore.getState().show(`${target.nickname}님을 차단했어요`, 'success');
        if (!leaveNotice) return;
        socket?.emit(CLIENT_EVENT.ROOM_LEAVE);
        router.replace('/(tabs)/' as never);
      };

      Alert.alert(`${target.nickname}님을 차단할까요?`, message, [
        { text: '닫기', style: 'cancel' },
        {
          text: '차단하기',
          style: 'destructive',
          onPress: () =>
            block(target.userId, {
              onSuccess: handleBlocked,
              onError: err => handleApiError(err, { fallbackType: 'toast' }),
            }),
        },
      ]);
    },
    [block, router],
  );

  // Android Alert는 버튼이 3개까지라 [취소, 차단, 신고]만 둔다
  const openChatActions = useCallback(
    (target: ModerationTarget): void => {
      Alert.alert(target.nickname, undefined, [
        { text: '취소', style: 'cancel' },
        { text: '차단하기', style: 'destructive', onPress: () => confirmBlock(target) },
        { text: '신고하기', onPress: () => openReport(target) },
      ]);
    },
    [confirmBlock, openReport],
  );

  return { confirmBlock, openChatActions };
}
