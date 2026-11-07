import { Text } from 'dripsy';
import { colors, textSizes } from '@/shared/config';
import type { Friend, PresenceStatus } from '@/shared/model';
import { Dialog, UserProfileView, type DialogButton } from '@/shared/ui';
import { ModerationActions, useReportStore } from '@/features/moderation';

type Props = {
  friend: Friend | null;
  onClose: () => void;
  onJoin: (room: NonNullable<Friend['room']>) => void;
  isJoining?: boolean;
};

const PRESENCE_COLOR: Record<PresenceStatus, string> = {
  ONLINE: colors.SUCCESS_400,
  OFFLINE: colors.LIGHT_500,
  IN_LOBBY: colors.INFO_300,
  IN_GAME: colors.PRIMARY_400,
};

const PRESENCE_LABEL: Record<PresenceStatus, string> = {
  ONLINE: '온라인',
  OFFLINE: '오프라인',
  IN_LOBBY: '대기실',
  IN_GAME: '게임 중',
};

// 친구 목록에서 친구를 눌렀을 때 — 대기실 프로필과 같은 본문에 접속 상태와 같이하기를 더한다
export function FriendProfileDialog({ friend, onClose, onJoin, isJoining = false }: Props) {
  const room = friend?.room;
  const openQueuedReport = useReportStore(s => s.openQueued);
  const statusLabel = (() => {
    if (!friend) return '';
    if (friend.presenceStatus === 'IN_LOBBY' && room) {
      return `대기실 · ${room.playerCount}/${room.playerCountMax}명`;
    }
    return PRESENCE_LABEL[friend.presenceStatus];
  })();

  const buttons: DialogButton[] = [{ label: '닫기', color: 'light', onPress: onClose }];
  if (room?.joinable) {
    buttons.push({ label: '같이하기', color: 'primary', onPress: () => onJoin(room), loading: isJoining });
  }

  return (
    <Dialog
      visible={friend !== null}
      onClose={onClose}
      onDismissed={openQueuedReport}
      title="프로필"
      buttons={buttons}
    >
      {friend && (
        <>
          <ModerationActions target={{ userId: friend.userId, nickname: friend.nickname }} onCloseHost={onClose} />
          <UserProfileView
            nickname={friend.nickname}
            friendCode={friend.friendCode}
            characterId={friend.characterId}
            frameId={friend.frameId}
            backgroundId={friend.backgroundId}
            chatColorId={friend.chatColorId}
            statusMessage={friend.statusMessage}
          />
          <Text sx={{ ...textSizes.B4, color: PRESENCE_COLOR[friend.presenceStatus], textAlign: 'center' }}>
            {statusLabel}
          </Text>
        </>
      )}
    </Dialog>
  );
}
