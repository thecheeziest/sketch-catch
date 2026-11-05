import { FeedbackPressable } from '@/shared/ui/FeedbackPressable';
import { colors, spacing, textSizes } from '@/shared/config';
import { Badge } from '@/shared/ui/Badge';
import { CosmeticAvatar } from '@/shared/ui/CosmeticAvatar';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import type { Player } from '@sketch-catch/shared';
import { Text, View } from 'dripsy';
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
  isLeft?: boolean; // 게임 강제종료 시 중도 퇴장 플레이어 표시
  isWaiting?: boolean; // 시상식에서 [한번 더!]로 대기실에 재입장해 다음 게임을 기다리는 플레이어
  onPress?: () => void;
  statusLabel?: string;
  // 시상식에 남은 방장에게 돌아오라고 재촉 - 시상식 중인 유저 카드 위에 버튼으로 표시
  onNudge?: () => void;
};

export function SlotCard({ player, isMe, cardWidth, isLeft = false, isWaiting = false, onPress, statusLabel, onNudge }: Props) {
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
      <View sx={{ margin: spacing.XS, width: cardWidth, height: cardWidth }}>
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
  const isReady = player.isReady && !isLeft;
  const backgroundColor = isLeft ? colors.DARK_100 : colors.SECONDARY_100;
  // 테두리를 장착하지 않았을 때만 쓰는 상태색
  const borderColor = (() => {
    if (isLeft) return colors.GRAY;
    if (isHost) return colors.PRIMARY_400;
    if (isMe || player.isReady) return colors.DARK_100;
    return colors.GRAY;
  })();
  const statusColor = (() => {
    if (isLeft) return colors.GRAY;
    if (isReady) return colors.SECONDARY_200;
    return colors.LIGHT_300;
  })();
  const secondaryLabel = (() => {
    if (isLeft) return '나감';
    if (statusLabel !== undefined) return statusLabel;
    if (player.isReady) return '준비 완료';
    return '대기 중';
  })();

  return (
    <FeedbackPressable onPress={onPress} disabled={!onPress}>
      <View sx={{ margin: spacing.XS, width: cardWidth }}>
        <View sx={{ width: cardWidth, height: cardWidth }}>
          <CosmeticAvatar
            characterId={player.characterId}
            frameId={player.frameId}
            backgroundId={player.backgroundId}
            size={cardWidth}
            defaultBorderColor={borderColor}
            defaultBackgroundColor={backgroundColor}
            backgroundOverlayColor={isReady ? READY_OVERLAY_COLOR : undefined}
            dimmed={isLeft || isWaiting}
          />
          {isHost && !isLeft && (
            <View style={styles.shineClip} pointerEvents="none">
              <Animated.View style={[styles.shine, shineStyle]} />
            </View>
          )}
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
          {isWaiting && !isLeft && (
            <View style={styles.awardOverlay} pointerEvents="none">
              <Text variant="B4" sx={{ color: colors.LIGHT_100, textAlign: 'center' }}>
                게임 대기 중
              </Text>
            </View>
          )}
          {/* 시상식에서 아직 [한번 더!]를 누르지 않은 유저 */}
          {player.inAward === true && (
            <View style={styles.awardOverlay} pointerEvents="box-none">
              <Text variant="B4" sx={{ color: colors.LIGHT_100, textAlign: 'center' }}>
                시상 중..
              </Text>
              {onNudge !== undefined && (
                <View sx={{ marginTop: spacing.XS }}>
                  <Button label="재촉하기" color="primary" height={26} onPress={onNudge} />
                </View>
              )}
            </View>
          )}
        </View>
        <View sx={{ paddingTop: spacing.XS }}>
          <Text
            sx={{ ...textSizes.B3, color: isLeft ? colors.GRAY : colors.LIGHT_100, textAlign: 'center' }}
            style={isLeft ? styles.strikethrough : undefined}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {player.nickname}
          </Text>
          {!isHost && (
            <Text variant="B4" sx={{ color: statusColor, textAlign: 'center' }} numberOfLines={1}>
              {secondaryLabel}
            </Text>
          )}
        </View>
      </View>
    </FeedbackPressable>
  );
}

// 준비 완료 시 배경 위에 덮는 반투명 흰색
const READY_OVERLAY_COLOR = `${colors.WHITE}73`;

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
  strikethrough: { textDecorationLine: 'line-through' },
  shineClip: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  shine: {
    position: 'absolute',
    top: -60,
    bottom: -60,
    left: 0,
    width: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
});
