import { Image, Text, View } from 'dripsy';
import { useState } from 'react';
import {
  useFriendRequests,
  useFriends,
  useRespondRequest,
  useSendFriendRequest,
  useSentFriendRequests,
} from '@/features/friends/api';
import { colors, getCharacterImageSource, spacing, textSizes } from '@/shared/config';
import { handleApiError } from '@/shared/lib';
import { useToastStore } from '@/shared/model';
import { Button, Dialog, type DialogButton } from '@/shared/ui';
import type { Player } from '@sketch-catch/shared';

type Props = {
  player: Player | null;
  onClose: () => void;
  // 방장이 대기실에서 다른 참가자를 눌렀을 때만 전달 — 있으면 '방장 넘기기' 버튼을 보여 준다
  onTransferHost?: (player: Player) => void;
};

type FriendRelation = 'FRIEND' | 'RECEIVED' | 'REQUESTED' | 'NONE';

// 상대가 이미 나에게 요청을 보낸 상태면 서버가 신청 대신 바로 수락 처리하고 accepted: true를 돌려준다
type SendFriendRequestResult = { ok: true; accepted?: boolean };

// 대기실에서 다른 참가자를 눌렀을 때 — 캐릭터 + 닉네임#해시태그, 친구가 아니면 친구 추가
export function PlayerProfileDialog({ player, onClose, onTransferHost }: Props) {
  const { data: friends = [] } = useFriends();
  const { data: sentRequests = [] } = useSentFriendRequests();
  const { data: receivedRequests = [] } = useFriendRequests();
  const sendRequest = useSendFriendRequest();
  const respondRequest = useRespondRequest();
  const [isConfirmingTransfer, setIsConfirmingTransfer] = useState(false);

  const relation: FriendRelation = (() => {
    if (!player) return 'NONE';
    if (friends.some((f) => f.userId === player.id)) return 'FRIEND';
    if (receivedRequests.some((r) => r.sender.id === player.id)) return 'RECEIVED';
    if (sentRequests.some((r) => r.receiver.id === player.id)) return 'REQUESTED';
    return 'NONE';
  })();

  const handleClose = (): void => {
    setIsConfirmingTransfer(false);
    onClose();
  };

  const handleAddFriend = (): void => {
    if (!player) return;
    sendRequest.mutate(`${player.nickname}#${player.friendCode}`, {
      onSuccess: (data) => {
        const isAccepted = (data as SendFriendRequestResult | undefined)?.accepted === true;
        useToastStore.getState().show(isAccepted ? '친구가 되었어요!' : '친구 요청을 보냈어요!', 'success');
      },
      onError: (err) => handleApiError(err, { fallbackType: 'toast' }),
    });
  };

  const handleAcceptFriend = (): void => {
    const request = receivedRequests.find((r) => r.sender.id === player?.id);
    if (!request) return;
    respondRequest.mutate(
      { requestId: request.id, action: 'ACCEPT' },
      {
        onSuccess: () => useToastStore.getState().show('친구가 되었어요!', 'success'),
        onError: (err) => handleApiError(err, { fallbackType: 'toast' }),
      },
    );
  };

  const handleConfirmTransfer = (): void => {
    if (!player || !onTransferHost) return;
    onTransferHost(player);
    handleClose();
  };

  const buttons: DialogButton[] = (() => {
    if (isConfirmingTransfer) {
      return [
        { label: '취소', color: 'light', onPress: () => setIsConfirmingTransfer(false) },
        { label: '넘기기', color: 'primary', onPress: handleConfirmTransfer },
      ];
    }
    const close: DialogButton = { label: '닫기', color: 'light', onPress: handleClose };
    if (relation === 'FRIEND') return [close];
    if (relation === 'RECEIVED') {
      return [close, { label: '친구 수락', color: 'primary', onPress: handleAcceptFriend, loading: respondRequest.isPending }];
    }
    if (relation === 'REQUESTED') return [close, { label: '요청 보냄', color: 'primary', onPress: () => undefined, disabled: true }];
    return [close, { label: '친구 추가', color: 'primary', onPress: handleAddFriend, loading: sendRequest.isPending }];
  })();

  const imageSource = player ? getCharacterImageSource(player.characterId) : null;

  if (isConfirmingTransfer && player) {
    return (
      <Dialog visible onClose={handleClose} title="방장 넘기기" buttons={buttons}>
        <Text sx={{ ...textSizes.B2, color: colors.LIGHT_100 }}>{player.nickname}님에게 방장을 넘길까요?</Text>
      </Dialog>
    );
  }

  return (
    <Dialog visible={player !== null} onClose={handleClose} title="프로필" buttons={buttons}>
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
          {onTransferHost && (
            <View sx={{ alignSelf: 'stretch', marginTop: spacing.XS }}>
              <Button label="방장 넘기기" color="secondary" onPress={() => setIsConfirmingTransfer(true)} />
            </View>
          )}
        </View>
      )}
    </Dialog>
  );
}
