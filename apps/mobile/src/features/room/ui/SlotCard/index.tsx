import { colors, getCharacterImageSource, spacing } from '@/shared/config';
import { Badge } from '@/shared/ui/Badge';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import type { Player } from '@sketch-catch/shared';
import { Image, Text, View } from 'dripsy';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  player: Player | null;
  isMe: boolean;
  cardWidth: number;
};

export function SlotCard({ player, isMe, cardWidth }: Props) {
  const shineProgress = useSharedValue(0);

  useEffect(() => {
    if (player?.isHost) {
      shineProgress.value = withRepeat(withTiming(1, { duration: 2000 }), -1, false);
    } else {
      cancelAnimation(shineProgress);
      shineProgress.value = 0;
    }
  }, [player?.isHost]);

  const shineStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(shineProgress.value, [0, 1], [-cardWidth * 1.5, cardWidth * 2.5]) },
      { rotate: '35deg' },
    ],
  }));

  if (player === null) {
    return (
      <View sx={{ aspectRatio: 0.85, margin: spacing.XS, width: cardWidth }}>
        <View
          sx={{
            flex: 1,
            borderWidth: isMe ? 3 : 2,
            borderColor: colors.SECONDARY_300,
            borderStyle: 'dashed',
            backgroundColor: colors.DARK_200,
          }}
        />
      </View>
    );
  }

  const isHost = player.isHost;
  const backgroundColor = player.isReady ? colors.SECONDARY_200 : colors.SECONDARY_100;
  const borderColor = isHost ? colors.PRIMARY_400 : isMe ? colors.DARK_100 : player.isReady ? colors.DARK_100 : colors.GRAY;
  const borderWidth = isMe ? 3 : 2;
  const imageSource = getCharacterImageSource(player.characterId);

  return (
    <View sx={{ aspectRatio: 0.85, margin: spacing.XS, width: cardWidth }}>
      <PixelFrame
        borderColor={borderColor}
        borderWidth={borderWidth}
        style={StyleSheet.absoluteFillObject}
      >
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor }]} />
        {isHost && (
          <View style={styles.badgeContainer}>
            <Badge label="방장" color={colors.PRIMARY_400} />
          </View>
        )}
        <View sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.SM }}>
          {imageSource !== null ? (
            <Image source={imageSource} sx={{ width: 48, height: 48 }} resizeMode="contain" />
          ) : (
            <View sx={{ width: 48, height: 48, backgroundColor: colors.SECONDARY_400 }} />
          )}
        </View>
        <View sx={{ paddingHorizontal: spacing.XS, paddingBottom: spacing.SM, gap: spacing.XS }}>
          <Text
            sx={{ color: player.isReady ? colors.LIGHT_100 : colors.SECONDARY_500, textAlign: 'center' }}
            numberOfLines={1}
          >
            {player.nickname}
          </Text>
          {!isHost && (
            <Text variant="B4" sx={{ color: player.isReady ? colors.LIGHT_100 : colors.DARK_100, textAlign: 'center' }}>
              {player.isReady ? '준비 완료' : '대기 중'}
            </Text>
          )}
        </View>
        {isHost && <Animated.View style={[styles.shine, shineStyle]} pointerEvents="none" />}
      </PixelFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeContainer: { position: 'absolute', top: 8, right: 8, zIndex: 1 },
  shine: {
    position: 'absolute',
    top: -60,
    bottom: -60,
    left: 0,
    width: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    zIndex: 2,
  },
});
