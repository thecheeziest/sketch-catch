import { useEffect } from 'react';
import { Image, ScrollView, Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import { Blur, Canvas, Circle, RoundedRect } from '@shopify/react-native-skia';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, fontFamily, getCharacterImageSource, spacing, textSizes } from '@/shared/config';
import { useGameStore } from '@/features/game/model/useGameStore';
import { playFeedback } from '@/shared/lib/feedback';

export type AudiencePlayer = {
  userId: string;
  nickname: string;
  characterId: string;
  rank: number;
  score: number;
  left: boolean;
  waiting?: boolean;
};

type Props = {
  /** 순위권(1~3위) 밖 플레이어 목록 — 방청석처럼 응원봉을 흔드는 연출로 표시 */
  players: AudiencePlayer[];
};

function CheerStick({ index, dimmed }: { index: number; dimmed: boolean }) {
  const swing = useSharedValue(0);

  useEffect(() => {
    if (dimmed) return undefined;
    swing.value = withDelay(
      index * 120,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 380, easing: Easing.inOut(Easing.quad) }),
          withTiming(-1, { duration: 380, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(swing);
  }, [swing, index, dimmed]);

  // 손잡이 끝을 회전축으로 두어 캐릭터 옆에서 응원봉을 흔든다.
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${18 + swing.value * 18}deg` }] }));

  return (
    <Animated.View style={[styles.stick, style, { opacity: dimmed ? 0.35 : 1 }]} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={18} cy={17} r={10} color="#72D8FF">
          <Blur blur={5} />
        </Circle>
        <Circle cx={18} cy={17} r={9} color="#69CFFF" />
        <Circle cx={18} cy={17} r={6.5} color="#D5F8FF" />
        <Circle cx={15} cy={14} r={2} color="#FFFFFF" />
        <RoundedRect x={12} y={24} width={12} height={5} r={2} color="#FFFFFF" />
        <RoundedRect x={15} y={27} width={6} height={15} r={2} color="#F5F7FF" />
        <Circle cx={18} cy={31} r={1} color="#A8B6CE" />
      </Canvas>
    </Animated.View>
  );
}

function AudienceCard({ player, index }: { player: AudiencePlayer; index: number }) {
  const bob = useSharedValue(0);
  const dimmed = player.left || player.waiting === true;

  useEffect(() => {
    if (dimmed) return undefined;
    bob.value = withDelay(
      index * 90,
      withRepeat(withSequence(withTiming(-4, { duration: 420 }), withTiming(0, { duration: 420 })), -1, true),
    );
    return () => cancelAnimation(bob);
  }, [bob, index, dimmed]);

  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));
  const imageSource = getCharacterImageSource(player.characterId);

  return (
    <View sx={{ alignItems: 'center', width: 64, marginHorizontal: spacing.XS }}>
      <Animated.View style={[{ width: 56, height: 52, justifyContent: 'flex-end', alignItems: 'center' }, bobStyle]}>
        {imageSource !== null ? (
          <Image
            source={imageSource}
            sx={{ width: 40, height: 40, opacity: dimmed ? 0.35 : 1 }}
            resizeMode="contain"
          />
        ) : (
          <View
            sx={{ width: 40, height: 40, backgroundColor: colors.SECONDARY_400, opacity: dimmed ? 0.35 : 1 }}
          />
        )}
        <CheerStick index={index} dimmed={dimmed} />
      </Animated.View>
      <Text
        sx={{
          fontFamily: fontFamily.REGULAR,
          fontSize: 10,
          color: dimmed ? colors.GRAY : colors.LIGHT_100,
          marginTop: 2,
        }}
        numberOfLines={1}
      >
        {player.rank}위 {player.nickname}
      </Text>
      <Text sx={{ ...textSizes.B4, color: dimmed ? colors.GRAY : colors.ACCENT_300 }}>
        {player.waiting === true && !player.left ? '게임 대기 중' : `${player.score}점`}
      </Text>
    </View>
  );
}

/** 순위권 밖 참가자를 관중석처럼 늘어세워 응원봉을 흔드는 애니메이션으로 보여준다. */
export function AudienceCheer({ players }: Props) {
  const gameId = useGameStore(s => s.result?.gameId);
  useEffect(() => {
    if (!gameId || players.length === 0) return;
    const timer = setTimeout(() => playFeedback('cheer', { key: `${gameId}:cheer` }), 2900);
    return () => clearTimeout(timer);
  }, [gameId, players.length]);
  if (players.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      sx={{ flexGrow: 0, height: 106 }}
      contentContainerSx={{ alignItems: 'flex-end', paddingHorizontal: spacing.MD }}
    >
      {players.map((p, i) => (
        <AudienceCard key={p.userId} player={p} index={i} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stick: {
    position: 'absolute',
    right: -10,
    bottom: 6,
    width: 36,
    height: 48,
    transformOrigin: '18px 40px',
  },
});
