import { useEffect } from 'react';
import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SlotCard } from '@/features/room/ui/SlotCard';
import { Icon } from '@/shared/ui/Icon';
import { colors, spacing, textSizes, fontFamily } from '@/shared/config';
import type { Player } from '@sketch-catch/shared';

type PodiumPlayer = {
  userId: string;
  nickname: string;
  characterId: string;
  score: number;
  left?: boolean;
};

type Props = {
  rank: 1 | 2 | 3;
  player: PodiumPlayer;
  baseCardWidth: number;
};

const SCALE: Record<1 | 2 | 3, number> = {
  1: 1.4,
  2: 1.1,
  3: 0.9,
};

const RANK_LABEL_COLOR: Record<1 | 2 | 3, string> = {
  1: colors.PRIMARY_400,
  2: colors.SECONDARY_300,
  3: colors.SECONDARY_100,
};

// 1위 전용 반짝임 — 카드 둘레 8방향에 배치된 조각별이 시차를 두고 깜빡인다
const SPARKLE_COUNT = 8;
const SPARKLES = Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
  angle: (i / SPARKLE_COUNT) * 2 * Math.PI,
  delay: i * 150,
}));

type SparkleProps = { angle: number; delay: number; radius: number };

function WinnerSparkle({ angle, delay, radius }: SparkleProps) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 260 }), withTiming(0, { duration: 900 })), -1, false),
    );
  }, [opacity, delay]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.sparkle,
        style,
        { transform: [{ translateX: Math.cos(angle) * radius - 4 }, { translateY: Math.sin(angle) * radius - 4 }] },
      ]}
      pointerEvents="none"
    />
  );
}

// 카드 뒤 후광 펄스 + 둘레 반짝임 + 위에서 까딱이는 트로피 — 1위 전용 연출 일체
function WinnerGlow({ cardWidth }: { cardWidth: number }) {
  const pulse = useSharedValue(0);
  const bounce = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    bounce.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 480, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 480, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [pulse, bounce]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.35,
    transform: [{ scale: 1 + pulse.value * 0.12 }],
  }));
  const trophyStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bounce.value }] }));

  const glowSize = Math.round(cardWidth * 1.6);
  const sparkleRadius = Math.round(cardWidth * 0.85);
  const trophySize = Math.round(cardWidth * 0.26);
  const trophyOffset = Math.round(cardWidth * 0.22);

  return (
    <>
      <Animated.View
        style={[
          styles.glow,
          glowStyle,
          {
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            marginLeft: -glowSize / 2,
            marginTop: -glowSize / 2,
          },
        ]}
        pointerEvents="none"
      />
      {SPARKLES.map((s) => (
        <WinnerSparkle key={s.angle} angle={s.angle} delay={s.delay} radius={sparkleRadius} />
      ))}
      <Animated.View
        style={[styles.trophy, trophyStyle, { top: -trophyOffset, marginLeft: -trophySize / 2 }]}
        pointerEvents="none"
      >
        <Icon name="TROPHY" size={trophySize} color={colors.WARNING_300} />
      </Animated.View>
    </>
  );
}

export function PodiumSlot({ rank, player, baseCardWidth }: Props) {
  const cardWidth = Math.round(baseCardWidth * SCALE[rank]);

  // 1위는 등장 시 통통 튀어 오르며 나타난다
  const entrance = useSharedValue(rank === 1 ? 0 : 1);
  useEffect(() => {
    if (rank !== 1) return;
    entrance.value = withDelay(150, withSpring(1, { damping: 8, stiffness: 180 }));
  }, [entrance, rank]);
  const entranceStyle = useAnimatedStyle(() => ({ transform: [{ scale: entrance.value }] }));

  // SlotCard는 Player | null을 받으므로 PodiumPlayer를 Player 형태로 변환한다.
  // 1위 전용 연출은 WinnerGlow가 전담 — isHost는 항상 false로 둬 '방장' 배지가 섞이지 않게 한다.
  const slotPlayer: Player = {
    id: player.userId,
    nickname: player.nickname,
    friendCode: '',
    characterId: player.characterId,
    slot: rank,
    isHost: false,
    isReady: false,
    connected: true,
  };

  return (
    <View sx={{ alignItems: 'center' }}>
      <Animated.View style={[{ width: cardWidth, alignItems: 'center' }, entranceStyle]}>
        {rank === 1 && player.left !== true && <WinnerGlow cardWidth={cardWidth} />}
        <SlotCard player={slotPlayer} isMe={false} cardWidth={cardWidth} isLeft={player.left === true} />
      </Animated.View>
      <Text
        style={[
          styles.rankLabel,
          { color: RANK_LABEL_COLOR[rank] },
        ]}
      >
        {rank}위
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rankLabel: {
    fontFamily: fontFamily.BOLD,
    ...textSizes.B1,
    marginTop: spacing.XS,
  },
  glow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    backgroundColor: colors.WARNING_300,
  },
  sparkle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 8,
    height: 8,
    marginTop: -4,
    marginLeft: -4,
    backgroundColor: colors.WARNING_200,
    zIndex: 3,
  },
  trophy: {
    position: 'absolute',
    left: '50%',
    zIndex: 3,
  },
});
