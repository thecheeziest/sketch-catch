import { Image, Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import type { Player } from '@sketch-catch/shared';
import { getCharacterImageSource, colors, spacing, textSizes } from '@/shared/config';
import { PixelFrame } from '@/shared/ui/PixelFrame';

type Props = {
  player: Player | null;
  isMe: boolean;
  isDrawer: boolean;
  cellWidth: number;
};

export function PlayerCell({ player, isMe, isDrawer, cellWidth }: Props) {
  // null spacer — 레이아웃 유지
  if (player === null) {
    return <View style={{ width: cellWidth, aspectRatio: 0.85, margin: spacing.XS }} />;
  }

  const borderColor = isDrawer ? colors.PRIMARY_400 : colors.DARK_100;
  const imageSource = getCharacterImageSource(player.characterId);

  return (
    <View style={{ width: cellWidth, aspectRatio: 0.85, margin: spacing.XS }}>
      <PixelFrame
        borderColor={borderColor}
        borderWidth={2}
        style={StyleSheet.absoluteFillObject}
      >
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.DARK_200 }]} />

        {/* ME! 칩 — 좌상단 */}
        {isMe && (
          <View style={styles.meChip}>
            <Text sx={{ ...textSizes.B4, color: colors.DARK_500 }}>ME!</Text>
          </View>
        )}

        {/* 출제자 뱃지 — 우상단 */}
        {isDrawer && (
          <View style={styles.drawerChip}>
            <Text sx={{ ...textSizes.B4, color: colors.LIGHT_100 }}>출제자</Text>
          </View>
        )}

        {/* 캐릭터 이미지 */}
        <View sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.SM }}>
          {imageSource !== null ? (
            <Image source={imageSource} sx={{ width: 40, height: 40 }} resizeMode="contain" />
          ) : (
            <View sx={{ width: 40, height: 40, backgroundColor: colors.SECONDARY_400 }} />
          )}
        </View>

        {/* 닉네임 */}
        <View sx={{ paddingHorizontal: spacing.XS, paddingBottom: spacing.XS }}>
          <Text sx={{ ...textSizes.B3, color: colors.LIGHT_100, textAlign: 'center' }} numberOfLines={1}>
            {player.nickname}
          </Text>
        </View>
      </PixelFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  meChip: {
    position: 'absolute',
    top: 3,
    left: 3,
    backgroundColor: colors.LIGHT_100,
    paddingHorizontal: 3,
    paddingVertical: 1,
    zIndex: 1,
  },
  drawerChip: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: colors.PRIMARY_400,
    paddingHorizontal: 3,
    paddingVertical: 1,
    zIndex: 1,
  },
});
