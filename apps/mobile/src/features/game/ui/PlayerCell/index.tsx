import { Image, Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import type { Player, ChatMessage } from '@sketch-catch/shared';
import { getCharacterImageSource, colors, spacing, textSizes } from '@/shared/config';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { ChatBubble } from '../ChatBubble';

type Props = {
  player: Player | null;
  isMe: boolean;
  isDrawer: boolean;
  isSelected: boolean;
  isLeft: boolean;
  cellWidth: number;
  activeBubble?: ChatMessage | null;
  isCorrectBubble?: boolean;
  onBubbleExpire?: () => void;
};

function getBorderColor(isDrawer: boolean, isSelected: boolean, isMe: boolean): string {
  if (isDrawer) return colors.PRIMARY_400;
  if (isSelected) return colors.SECONDARY_400;
  if (isMe) return colors.LIGHT_100;
  return colors.DARK_100;
}

export function PlayerCell({ player, isMe, isDrawer, isSelected, isLeft, cellWidth, activeBubble, isCorrectBubble = false, onBubbleExpire }: Props) {
  if (player === null) {
    return <View style={{ width: cellWidth, aspectRatio: 0.85, margin: spacing.XS }} />;
  }

  const borderColor = getBorderColor(isDrawer, isSelected, isMe);
  const imageSource = getCharacterImageSource(player.characterId);

  return (
    <View style={{ width: cellWidth, aspectRatio: 0.85, margin: spacing.XS }}>
      <PixelFrame
        borderColor={borderColor}
        borderWidth={isSelected ? 3 : 2}
        style={StyleSheet.absoluteFillObject}
      >
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.DARK_200 }]} />

        {activeBubble != null && onBubbleExpire != null && (
          <ChatBubble
            text={activeBubble.text}
            isCorrect={isCorrectBubble}
            onExpire={onBubbleExpire}
          />
        )}

        <View sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.SM }}>
          {imageSource !== null ? (
            <Image source={imageSource} sx={{ width: 40, height: 40 }} resizeMode="contain" style={isLeft ? styles.dimmedImage : undefined} />
          ) : (
            <View sx={{ width: 40, height: 40, backgroundColor: colors.SECONDARY_400 }} style={isLeft ? styles.dimmedImage : undefined} />
          )}
        </View>

        <View sx={{ paddingHorizontal: spacing.XS, paddingBottom: spacing.XS }}>
          <Text
            sx={{ ...textSizes.B3, color: isLeft ? colors.DARK_100 : colors.LIGHT_100, textAlign: 'center', textDecorationLine: isLeft ? 'line-through' : 'none' }}
            numberOfLines={1}
          >
            {player.nickname}
          </Text>
        </View>
      </PixelFrame>

      {/* 퇴장 플레이어 반투명 오버레이 */}
      {isLeft && <View style={[StyleSheet.absoluteFillObject, styles.leftOverlay]} pointerEvents="none" />}
    </View>
  );
}

const styles = StyleSheet.create({
  dimmedImage: { opacity: 0.35 },
  leftOverlay: {
    backgroundColor: 'rgba(12, 10, 22, 0.55)',
  },
});
