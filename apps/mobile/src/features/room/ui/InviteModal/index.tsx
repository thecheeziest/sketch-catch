import { Image, Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import { INVITE_RESEND_COOLDOWN_SEC } from '@sketch-catch/shared';
import { useFriends } from '@/features/friends/api';
import { useInvite } from '@/features/room/api/useInvite';
import { type InviteCooldownStatus, useInviteCooldown } from '@/features/room/lib/useInviteCooldown';
import { colors, getCharacterImageSource, spacing } from '@/shared/config';
import { handleApiError } from '@/shared/lib';
import type { Friend } from '@/shared/model';
import { useRoomStore, useToastStore } from '@/shared/model';
import { Button, Dialog, FlatList, SketchbookLoadingSpinner } from '@/shared/ui';

type Props = {
  visible: boolean;
  onClose: () => void;
  code: string;
};

const PRESENCE_COLOR: Record<Friend['presenceStatus'], string> = {
  ONLINE: colors.SUCCESS_400,
  OFFLINE: colors.LIGHT_500,
  IN_LOBBY: colors.INFO_300,
  IN_GAME: colors.PRIMARY_400,
};

const PRESENCE_LABEL: Record<Friend['presenceStatus'], string> = {
  ONLINE: '온라인',
  OFFLINE: '오프라인',
  IN_LOBBY: '게임 대기실',
  IN_GAME: '게임 중',
};

const INVITE_LABEL: Record<InviteCooldownStatus, string> = {
  idle: '초대',
  coolingDown: '초대 중',
  resendable: '초대',
};

// 이미 대기실·게임에 있는 친구는 초대해도 반응할 수 없으므로 목록에는 보이되 초대 버튼은 막는다 (서버도 TARGET_BUSY로 거부)
function isBusy(friend: Friend): boolean {
  return friend.presenceStatus === 'IN_LOBBY' || friend.presenceStatus === 'IN_GAME';
}

export function InviteModal({ visible, onClose, code }: Props) {
  const { data: friends = [], isLoading } = useFriends({ subscribed: visible });
  const invite = useInvite(code);
  const players = useRoomStore(s => s.roomState?.players);
  const availableFriends = friends.filter(friend => !players?.some(p => p.id === friend.userId));
  // 이 대기실에서 초대를 보낸 친구 — 모달을 닫았다 열어도 유지된다
  const { getStatus, markInvited } = useInviteCooldown(INVITE_RESEND_COOLDOWN_SEC * 1000);

  const handleInvite = (friend: Friend): void => {
    invite.mutate(
      { target: friend.userId },
      {
        onSuccess: () => {
          markInvited(friend.userId);
          useToastStore.getState().show('초대장을 보냈어요!', 'success');
        },
        onError: err => {
          // 서버 쿨다운이 아직 남아 있으면(앱 재시작 등) 버튼도 쿨다운 상태로 맞춘다
          if (err.code === 'INVITE_COOLDOWN') markInvited(friend.userId);
          handleApiError(err, {
            fallbackType: 'toast',
            fallbackMessage: '초대를 보내지 못했어요!',
          });
        },
      },
    );
  };

  return (
    <Dialog visible={visible} onClose={onClose} title="친구 초대" dismissible>
      <View sx={{ maxHeight: 360 }}>
        <FlatList
          data={availableFriends}
          keyExtractor={item => item.friendshipId}
          renderItem={({ item }) => {
            const imageSource = getCharacterImageSource(item.characterId);
            return (
              <View style={styles.row}>
                <View
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: PRESENCE_COLOR[item.presenceStatus],
                  }}
                />
                {imageSource !== null ? (
                  <Image source={imageSource} sx={{ width: 32, height: 32 }} resizeMode="contain" />
                ) : (
                  <View sx={{ width: 32, height: 32, backgroundColor: colors.SECONDARY_400 }} />
                )}
                <View sx={{ flex: 1 }}>
                  <Text sx={{ color: colors.LIGHT_100 }}>{item.nickname}</Text>
                  <Text variant="B4" sx={{ color: PRESENCE_COLOR[item.presenceStatus] }}>
                    {PRESENCE_LABEL[item.presenceStatus]}
                  </Text>
                </View>
                <Button
                  label={INVITE_LABEL[getStatus(item.userId)]}
                  color="secondary"
                  height={32}
                  disabled={getStatus(item.userId) === 'coolingDown' || isBusy(item)}
                  loading={invite.isPending && invite.variables?.target === item.userId}
                  onPress={() => handleInvite(item)}
                />
              </View>
            );
          }}
          ListEmptyComponent={
            <View sx={{ paddingVertical: spacing.XL, alignItems: 'center' }}>
              {isLoading ? (
                <SketchbookLoadingSpinner size={140} accessibilityLabel="친구 목록 불러오는 중" />
              ) : (
                <Text variant="B4" sx={{ color: colors.LIGHT_500 }}>
                  초대할 수 있는 친구가 없어요
                </Text>
              )}
            </View>
          }
        />
      </View>
      <Button label="닫기" color="light" onPress={onClose} />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    paddingHorizontal: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
