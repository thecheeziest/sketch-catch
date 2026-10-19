import { Text } from 'dripsy';
import { colors, textSizes } from '@/shared/config';
import { Dialog, type DialogButton } from '@/shared/ui';
import type { ApiError } from '@/shared/api';
import type { RoomPreview } from '@sketch-catch/shared';
import { useRoomPreview } from '../../api/useRoomPreview';

type Props = {
  roomCode: string | null;
  onEnter: (roomCode: string) => void;
  onClose: () => void;
};

type EntryContent = { title: string; message: string; canEnter: boolean };

function getEntryContent(preview: RoomPreview | undefined, error: ApiError | null): EntryContent {
  if (error?.code === 'ROOM_NOT_FOUND') {
    return { title: '방이 사라졌어요', message: '초대받은 방이 이미 없어졌어요.', canEnter: false };
  }
  if (error) return { title: '게임 초대', message: '방 정보를 불러오지 못했어요.', canEnter: false };
  if (!preview) return { title: '게임 초대', message: '방 정보를 불러오고 있어요...', canEnter: false };
  if (preview.status !== 'LOBBY') {
    return { title: '게임 초대', message: '이미 게임이 시작된 방이에요!', canEnter: false };
  }
  if (preview.full) return { title: '게임 초대', message: '방이 꽉 찼어요!', canEnter: false };
  return { title: '게임 초대', message: `'${preview.title}'에 입장할까요?`, canEnter: true };
}

// 방에 있지 않을 때 게임 초대 푸시를 누르면 — 초대된 방 제목을 보여 주고 입장 여부를 묻는다
export function InviteEntryDialog({ roomCode, onEnter, onClose }: Props) {
  const { data: preview, error, isPending } = useRoomPreview(roomCode);
  const content = getEntryContent(preview, error);

  const close: DialogButton = { label: '닫기', color: 'light', onPress: onClose };
  const buttons: DialogButton[] =
    content.canEnter || isPending
      ? [
          close,
          {
            label: '입장하기',
            color: 'primary',
            onPress: () => roomCode && onEnter(roomCode),
            disabled: !content.canEnter,
            loading: isPending,
          },
        ]
      : [close];

  return (
    <Dialog visible={roomCode !== null} onClose={onClose} title={content.title} buttons={buttons}>
      <Text sx={{ ...textSizes.B2, color: colors.LIGHT_100 }}>{content.message}</Text>
    </Dialog>
  );
}
