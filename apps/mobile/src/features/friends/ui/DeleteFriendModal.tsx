import { Text } from 'dripsy'
import { Dialog } from '@/shared/ui';
import { useDeleteFriend } from '@/features/friends/api';
import { useToastStore } from '@/shared/model';
import { colors } from '@/shared/config';

type Props = {
  visible: boolean;
  onClose: () => void;
  friendNickname: string;
  friendUserId: string;
};

export function DeleteFriendModal({ visible, onClose, friendNickname, friendUserId }: Props) {
  const { mutate, isPending } = useDeleteFriend();

  const handleDelete = (): void => {
    mutate(friendUserId, {
      onSuccess: () => {
        useToastStore.getState().show('친구 목록에서 삭제했어요');
        onClose();
      },
      onError: () => {
        useToastStore.getState().show('연결에 실패했어요. 잠시 후 다시 시도해주세요.');
      },
    });
  };

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title="친구 삭제"
      buttons={[
        { label: '취소', color: 'light', onPress: onClose, disabled: isPending },
        { label: '삭제하기', color: 'dark', onPress: handleDelete, disabled: isPending },
      ]}
    >
      <Text variant="B4" sx={{ color: colors.GRAY }}>
        {friendNickname}님을 친구 목록에서 삭제할까요? 상대방 목록에서도 삭제돼요.
      </Text>
    </Dialog>
  );
}
