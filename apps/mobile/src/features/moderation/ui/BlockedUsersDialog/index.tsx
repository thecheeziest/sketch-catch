import { Image, ScrollView, Text, View } from 'dripsy';
import { colors, getCharacterImageSource, spacing, textSizes } from '@/shared/config';
import { handleApiError } from '@/shared/lib';
import { useToastStore } from '@/shared/model';
import { Button, Dialog, PixelLoadingSpinner } from '@/shared/ui';
import { useBlockedUsers, useUnblockUser } from '../../api';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const AVATAR_SIZE = 28;

// 설정 > 차단 목록 — 차단한 유저를 보고 차단을 푼다
export function BlockedUsersDialog({ visible, onClose }: Props) {
  const { data: blockedUsers, isLoading, isError, refetch } = useBlockedUsers();
  const unblock = useUnblockUser();

  const handleUnblock = (userId: string, nickname: string): void => {
    unblock.mutate(userId, {
      onSuccess: () => useToastStore.getState().show(`${nickname}님 차단을 풀었어요`, 'success'),
      onError: err => handleApiError(err, { fallbackType: 'toast' }),
    });
  };

  const body = (() => {
    if (isLoading) {
      return (
        <View sx={{ alignItems: 'center', paddingVertical: spacing.LG }}>
          <PixelLoadingSpinner accessibilityLabel="차단 목록 불러오는 중" />
        </View>
      );
    }
    if (isError) {
      return (
        <View sx={{ gap: spacing.SM, alignItems: 'center' }}>
          <Text sx={{ ...textSizes.B3, color: colors.GRAY }}>차단 목록을 불러오지 못했어요</Text>
          <Button label="다시 시도" color="secondary" height={36} onPress={() => void refetch()} />
        </View>
      );
    }
    if (!blockedUsers || blockedUsers.length === 0) {
      return <Text sx={{ ...textSizes.B3, color: colors.GRAY, textAlign: 'center' }}>차단한 사용자가 없어요</Text>;
    }
    return (
      <ScrollView sx={{ maxHeight: 320 }} contentContainerStyle={{ gap: spacing.SM }}>
        {blockedUsers.map(user => {
          const imageSource = getCharacterImageSource(user.characterId);
          const isPending = unblock.isPending && unblock.variables === user.userId;
          return (
            <View key={user.userId} sx={sxStyles.row}>
              {imageSource !== null && (
                <Image source={imageSource} sx={{ width: AVATAR_SIZE, height: AVATAR_SIZE }} resizeMode="contain" />
              )}
              <Text sx={{ ...textSizes.B2, color: colors.LIGHT_100, flex: 1 }} numberOfLines={1}>
                {user.nickname}
                <Text sx={{ color: colors.GRAY }}>#{user.friendCode}</Text>
              </Text>
              <Button
                label="차단 해제"
                color="light"
                height={32}
                loading={isPending}
                disabled={unblock.isPending && !isPending}
                onPress={() => handleUnblock(user.userId, user.nickname)}
              />
            </View>
          );
        })}
      </ScrollView>
    );
  })();

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title="차단 목록"
      buttons={[{ label: '닫기', color: 'light', onPress: onClose }]}
    >
      {body}
    </Dialog>
  );
}

const sxStyles = {
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.SM,
  },
};
