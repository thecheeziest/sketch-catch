import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PixelModal } from '@/shared/ui/PixelModal';
import { PixelButton } from '@/shared/ui/PixelButton';
import { useDeleteFriend } from '@/features/friends/api/useDeleteFriend';
import { useToastStore } from '@/shared/model/toast';
import { colors, typography, fontFamily } from '@/shared/config/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  friendNickname: string;
  friendUserId: string;
};

export function DeleteFriendModal({ visible, onClose, friendNickname, friendUserId }: Props): React.JSX.Element {
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
    <PixelModal visible={visible} onClose={onClose} title="친구 삭제">
      <Text style={styles.body} allowFontScaling={false}>
        {friendNickname}님을 친구 목록에서 삭제할까요? 상대방 목록에서도 삭제돼요.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <PixelButton label="취소" variant="secondary" onPress={onClose} disabled={isPending} />
        </View>
        <Pressable
          onPress={handleDelete}
          disabled={isPending}
          style={({ pressed }) => [
            styles.destructiveBtn,
            pressed && { opacity: 0.7 },
            isPending && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.destructiveLabel} allowFontScaling={false}>
            삭제하기
          </Text>
        </Pressable>
      </View>
    </PixelModal>
  );
}

const styles = StyleSheet.create({
  body: {
    fontFamily: fontFamily.regular,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
  },
  destructiveBtn: {
    height: 48,
    backgroundColor: colors.destructive,
    borderWidth: 2,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  destructiveLabel: {
    fontFamily: fontFamily.regular,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.background,
  },
});
