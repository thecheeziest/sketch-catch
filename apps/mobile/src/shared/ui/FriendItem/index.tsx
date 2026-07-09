import { Image, Text, View } from 'dripsy'
import { colors, getCharacterImageSource } from '@/shared/config';
import type { Friend } from '@/shared/model';
import { Button } from '../Button';
import { Pressable, StyleSheet } from 'react-native';

type Props = { friend: Friend; onLongPress: () => void; onJoin?: () => void; index?: number };

const PRESENCE_COLOR: Record<Friend['presenceStatus'], string> = {
  ONLINE: colors.SUCCESS_400,
  OFFLINE: colors.LIGHT_500,
  IN_LOBBY: colors.INFO_300,
  IN_GAME: colors.PRIMARY_400,
};

const PRESENCE_LABEL: Record<Friend['presenceStatus'], string> = {
  ONLINE: '온라인',
  OFFLINE: '오프라인',
  IN_LOBBY: '대기실',
  IN_GAME: '게임 중',
};

const ROW_BG = [`${colors.WHITE}70`, `${colors.PRIMARY_300}70`] as const;

export function FriendItem({ friend, onLongPress, onJoin, index }: Props) {
  const imageSource = getCharacterImageSource(friend.characterId);
  const bgColor = index !== undefined ? ROW_BG[index % 2] : 'transparent';

  const statusLabel =
    friend.presenceStatus === 'IN_LOBBY' && friend.room
      ? `대기실 · ${friend.room.playerCount}/${friend.room.playerCountMax}명`
      : PRESENCE_LABEL[friend.presenceStatus];

  return (
    <Pressable
      style={[styles.row, { backgroundColor: bgColor }]}
      onLongPress={onLongPress}
      delayLongPress={500}
    >
      <View
        sx={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: PRESENCE_COLOR[friend.presenceStatus],
        }}
      />
      {imageSource !== null ? (
        <Image source={imageSource} sx={{ width: 40, height: 40 }} resizeMode="contain" />
      ) : (
        <View sx={{ width: 40, height: 40, backgroundColor: colors.SECONDARY_400 }} />
      )}
      <View sx={{ flex: 1 }}>
        <Text sx={{ color: colors.LIGHT_100 }}>
          {friend.nickname}
        </Text>
        <Text variant="B4" sx={{ color: PRESENCE_COLOR[friend.presenceStatus] }}>
          {statusLabel}
        </Text>
      </View>
      {friend.room?.joinable && onJoin ? (
        <Button label="같이하기" color="secondary" height={32} onPress={onJoin} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.BLACK,
  },
});
