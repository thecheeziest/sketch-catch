import { Image, Text, View } from 'dripsy';
import { useFriends, useSendFriendRequest, useSentFriendRequests } from '@/features/friends/api';
import { colors, getCharacterImageSource, spacing, textSizes } from '@/shared/config';
import { handleApiError } from '@/shared/lib';
import { useToastStore } from '@/shared/model';
import { Dialog, type DialogButton } from '@/shared/ui';
import type { Player } from '@sketch-catch/shared';

type Props = {
  player: Player | null;
  onClose: () => void;
};

type FriendRelation = 'FRIEND' | 'REQUESTED' | 'NONE';

// 대기실에서 다른 참가자를 눌렀을 때 — 캐릭터 + 닉네임#해시태그, 친구가 아니면 친구 추가
export function PlayerProfileDialog({ player, onClose }: Props) {
  const { data: friends = [] } = useFriends();
  const { data: sentRequests = [] } = useSentFriendRequests();
  const sendRequest = useSendFriendRequest();

  const relation: FriendRelation = (() => {
    if (!player) return 'NONE';
    if (friends.some((f) => f.userId === player.id)) return 'FRIEND';
    if (sentRequests.some((r) => r.receiver.id === player.id)) return 'REQUESTED';
    return 'NONE';
  })();

  const handleAddFriend = (): void => {
    if (!player) return;
    sendRequest.mutate(`${player.nickname}#${player.friendCode}`, {
      onSuccess: () => useToastStore.getState().show('친구 요청을 보냈어요'),
      onError: (err) => handleApiError(err, { fallbackType: 'toast' }),
    });
  };

  const buttons: DialogButton[] = (() => {
    const close: DialogButton = { label: '닫기', color: 'light', onPress: onClose };
    if (relation === 'FRIEND') return [close];
    if (relation === 'REQUESTED') return [close, { label: '요청 보냄', color: 'primary', onPress: () => undefined, disabled: true }];
    return [close, { label: '친구 추가', color: 'primary', onPress: handleAddFriend, loading: sendRequest.isPending }];
  })();

  const imageSource = player ? getCharacterImageSource(player.characterId) : null;

  return (
    <Dialog visible={player !== null} onClose={onClose} title="프로필" buttons={buttons}>
      {player && (
        <View sx={{ alignItems: 'center', gap: spacing.SM, paddingVertical: spacing.SM }}>
          {imageSource !== null ? (
            <Image source={imageSource} sx={{ width: 72, height: 72 }} resizeMode="contain" />
          ) : (
            <View sx={{ width: 72, height: 72, backgroundColor: colors.SECONDARY_400 }} />
          )}
          <Text sx={{ ...textSizes.T3, color: colors.LIGHT_100 }}>
            {player.nickname}
            <Text sx={{ color: colors.GRAY }}>#{player.friendCode}</Text>
          </Text>
          {relation === 'FRIEND' && <Text sx={{ ...textSizes.B4, color: colors.PRIMARY_100 }}>이미 친구예요</Text>}
        </View>
      )}
    </Dialog>
  );
}
