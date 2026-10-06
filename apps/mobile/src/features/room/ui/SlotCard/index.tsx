import { colors, getCharacterImageSource, spacing, textSizes } from '@/shared/config';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import type { Player } from '@sketch-catch/shared';
import { Image, Text, View } from 'dripsy';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
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
  isLeft?: boolean; // 게임 강제종료 시 중도 퇴장 플레이어 표시
  onPress?: () => void;
};

export function SlotCard({ player, isMe, cardWidth, isLeft = false, onPress }: Props) {
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
  const backgroundColor = isLeft ? colors.DARK_100 : player.isReady ? colors.SECONDARY_200 : colors.SECONDARY_100;
  const borderColor = isLeft
    ? colors.GRAY
    : isHost
      ? colors.PRIMARY_400
      : isMe
        ? colors.DARK_100
        : player.isReady
          ? colors.DARK_100
          : colors.GRAY;
  const borderWidth = isMe ? 3 : 2;
  const imageSource = getCharacterImageSource(player.characterId);
  // 좁은 그리드(4열 등)에서 캐릭터 이미지가 카드 높이를 넘겨 닉네임과 겹치지 않도록 카드 폭에 비례
  const charSize = Math.max(28, Math.min(44, Math.round(cardWidth * 0.5)));

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
    <View sx={{ aspectRatio: 0.85, margin: spacing.XS, width: cardWidth }}>
      <PixelFrame
        borderColor={borderColor}
        borderWidth={borderWidth}
        style={StyleSheet.absoluteFill}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor }]} />
        {isHost && !isLeft && (
          <View style={styles.badgeContainer}>
            <Badge label="방장" color={colors.PRIMARY_400} />
          </View>
        )}
        {isLeft && (
          <View style={[styles.badgeContainer, styles.leftBadge]}>
            <Icon name="CLOSE" size={14} color={colors.LIGHT_100} />
          </View>
        )}
        <View sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.XS }}>
          {imageSource !== null ? (
            <Image
              source={imageSource}
              sx={{ width: charSize, height: charSize }}
              resizeMode="contain"
              style={isLeft ? styles.dimmedImage : undefined}
            />
          ) : (
            <View
              sx={{ width: charSize, height: charSize, backgroundColor: colors.SECONDARY_400 }}
              style={isLeft ? styles.dimmedImage : undefined}
            />
          )}
        </View>
        <View sx={{ paddingHorizontal: spacing.XS, paddingBottom: spacing.XS }}>
          <Text
            sx={{ ...textSizes.B3, color: isLeft ? colors.GRAY : player.isReady ? colors.LIGHT_100 : colors.SECONDARY_500, textAlign: 'center' }}
            style={isLeft ? styles.strikethrough : undefined}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {player.nickname}
          </Text>
          {!isHost && (
            <Text variant="B4" sx={{ color: isLeft ? colors.GRAY : player.isReady ? colors.LIGHT_100 : colors.DARK_100, textAlign: 'center' }} numberOfLines={1}>
              {isLeft ? '나감' : player.isReady ? '준비 완료' : '대기 중'}
            </Text>
          )}
        </View>
        {isHost && !isLeft && <Animated.View style={[styles.shine, shineStyle]} pointerEvents="none" />}
        {/* 시상식에서 아직 [한번 더!]를 누르지 않은 유저 */}
        {player.inAward === true && (
          <View style={styles.awardOverlay} pointerEvents="none">
            <Text variant="B4" sx={{ color: colors.LIGHT_100, textAlign: 'center' }}>
              시상 진행 중..
            </Text>
          </View>
        )}
      </PixelFrame>
    </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  awardOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.DARK_200}B3`,
  },
  badgeContainer: { position: 'absolute', top: 8, right: 8, zIndex: 1 },
  leftBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.GRAY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmedImage: { opacity: 0.35 },
  strikethrough: { textDecorationLine: 'line-through' },
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
