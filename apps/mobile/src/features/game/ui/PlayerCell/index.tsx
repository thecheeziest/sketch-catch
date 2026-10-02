import { Image, Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import type { Player } from '@sketch-catch/shared';
import { fontFamily, getCharacterImageSource } from '@/shared/config';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { gameSurface, gameText, playerDot, playerRing } from '@/features/game/config';

type Props = {
  player: Player | null;
  isMe: boolean;
  isDrawer: boolean;
  isSolved: boolean;
  hasGuessed: boolean;
  isSelected: boolean;
  isLeft: boolean;
  cellWidth: number;
};

function getRingColor(isDrawer: boolean, isSolved: boolean, isSelected: boolean): string {
  if (isDrawer) return playerRing.DRAWER;
  if (isSolved) return playerRing.SOLVED;
  if (isSelected) return playerRing.SELECTED;
  return playerRing.IDLE;
}

function getDotColor(isDrawer: boolean, isSolved: boolean, hasGuessed: boolean): string {
  if (isDrawer) return playerDot.DRAWER;
  if (isSolved) return playerDot.SOLVED;
  if (hasGuessed) return playerDot.GUESSING;
  return playerDot.SILENT;
}

function getNameColor(isLeft: boolean, isMe: boolean): string {
  if (isLeft) return playerRing.IDLE;
  if (isMe) return gameText.PRIMARY;
  return gameText.SECONDARY;
}

export function PlayerCell({ player, isMe, isDrawer, isSolved, hasGuessed, isSelected, isLeft, cellWidth }: Props) {
  if (player === null) {
    return <View style={{ width: cellWidth, aspectRatio: 0.85, margin: 3 }} />;
  }

  const ringColor = getRingColor(isDrawer, isSolved, isSelected);
  const dotColor = getDotColor(isDrawer, isSolved, hasGuessed);
  const imageSource = getCharacterImageSource(player.characterId);

  return (
    <View style={{ width: cellWidth, aspectRatio: 0.85, margin: 3 }}>
      <PixelFrame borderColor={ringColor} borderWidth={isSelected ? 3 : 2} style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: gameSurface.SUBPANEL }]} />
      </PixelFrame>

      <View sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 4 }}>
        {imageSource !== null ? (
          <Image
            source={imageSource}
            sx={{ width: 28, height: 28 }}
            resizeMode="contain"
            style={isLeft ? styles.dimmed : undefined}
          />
        ) : (
          <View sx={{ width: 28, height: 28, backgroundColor: playerRing.SELECTED }} style={isLeft ? styles.dimmed : undefined} />
        )}

        <Text
          sx={{
            fontFamily: fontFamily.REGULAR,
            fontSize: 11,
            lineHeight: 14,
            color: getNameColor(isLeft, isMe),
            textDecorationLine: isLeft ? 'line-through' : 'none',
          }}
          numberOfLines={1}
        >
          {player.nickname}
        </Text>

        <View style={[styles.dot, { backgroundColor: dotColor }]} />
      </View>

      {isLeft && <View style={[StyleSheet.absoluteFill, styles.leftOverlay]} pointerEvents="none" />}
    </View>
  );
}

const styles = StyleSheet.create({
  dimmed: { opacity: 0.35 },
  dot: {
    width: 8,
    height: 8,
  },
  leftOverlay: {
    backgroundColor: 'rgba(12, 8, 19, 0.55)',
  },
});
