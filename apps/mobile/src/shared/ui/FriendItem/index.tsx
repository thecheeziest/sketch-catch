import { FeedbackPressable } from '@/shared/ui/FeedbackPressable';
import { Image, Text, View } from 'dripsy'
import { colors, getCharacterImageSource } from '@/shared/config';
import type { Friend } from '@/shared/model';
import type { PixelSpriteData } from '@sketch-catch/shared';
import { Button } from '../Button';
import { PixelSprite } from '../PixelSprite';
import { StyleSheet } from 'react-native';

type Props = {
  friend: Friend;
  onPress?: () => void;
  onDelete: () => void;
  onJoin?: () => void;
  isJoining?: boolean;
  index?: number;
};

// 사람 + 빼기 — 차단(사람 + 금지 기호)과 구분되도록 X 대신 빼기를 쓴다
const UNFRIEND_SPRITE: PixelSpriteData = {
  rows: [
    '..lll........',
    '.lllll.......',
    '.lllll.......',
    '..lll........',
    '........rrrrr',
    '.lllll..rrrrr',
    'lllllll......',
    'lllllll......',
    'lllllll......',
  ],
  colors: { l: colors.LIGHT_500, r: colors.ERROR_300 },
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
  IN_LOBBY: '대기실',
  IN_GAME: '게임 중',
};

const ROW_BG = [`${colors.WHITE}70`, `${colors.PRIMARY_300}70`] as const;

export function FriendItem({ friend, onPress, onDelete, onJoin, isJoining, index }: Props) {
  const imageSource = getCharacterImageSource(friend.characterId);
  const bgColor = index !== undefined ? ROW_BG[index % 2] : 'transparent';

  const statusLabel =
    friend.presenceStatus === 'IN_LOBBY' && friend.room
      ? `대기실 · ${friend.room.playerCount}/${friend.room.playerCountMax}명`
      : PRESENCE_LABEL[friend.presenceStatus];

  return (
    <View style={[styles.row, { backgroundColor: bgColor }]}>
      <FeedbackPressable
        onPress={onPress}
        disabled={!onPress}
        style={styles.info}
        accessibilityRole="button"
        accessibilityLabel={`${friend.nickname} 프로필 보기`}
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
      </FeedbackPressable>
      {friend.room?.joinable && onJoin ? (
        <Button label="같이하기" color="secondary" height={32} onPress={onJoin} disabled={isJoining} />
      ) : null}
      <FeedbackPressable
        onPress={onDelete}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`${friend.nickname} 친구 삭제`}
      >
        <PixelSprite sprite={UNFRIEND_SPRITE} pixelSize={1.5} />
      </FeedbackPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  info: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
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
