import { Fragment, useEffect } from 'react';
import { Image, Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
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
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { colors, fontFamily, getCharacterImageSource, spacing, textSizes } from '@/shared/config';
import { useGameStore } from '@/features/game/model/useGameStore';
import { playFeedback } from '@/shared/lib/feedback';

export type PenaltyAwardPlayer = {
  userId: string;
  nickname: string;
  characterId: string;
  score: number;
  left: boolean;
  waiting?: boolean;
};

type Props = {
  text: string;
  // 단상 위에 모이는 사람(꼴찌가 아닌 사람)
  safePlayers: PenaltyAwardPlayer[];
  // 벌칙에 걸려 무대 밖에서 우는 사람
  losers: PenaltyAwardPlayer[];
};

const CRY_SIZE = 64;
const TEAR_SIZE = 5;
// 캐릭터 스프라이트의 눈 위치(가로 비율) — 양쪽 눈에서 눈물이 떨어진다
const EYE_X = [0.32, 0.62];
const EYE_Y = 0.42;

// 단상 위 인원이 많을수록 캐릭터를 줄여 한 무대에 모두 올린다
function getStageCharacterSize(count: number): number {
  if (count <= 4) return 52;
  if (count <= 8) return 40;
  return 32;
}

function PixelTear({ x, delay }: { x: number; delay: number }) {
  const fall = useSharedValue(0);

  useEffect(() => {
    fall.value = withDelay(delay, withRepeat(withTiming(1, { duration: 700, easing: Easing.in(Easing.quad) }), -1));
    return () => cancelAnimation(fall);
  }, [fall, delay]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - fall.value * 0.8,
    transform: [{ translateY: fall.value * 22 }],
  }));

  return <Animated.View style={[styles.tear, style, { left: x, top: CRY_SIZE * EYE_Y }]} pointerEvents="none" />;
}

function CryingCharacter({ player, index }: { player: PenaltyAwardPlayer; index: number }) {
  const sob = useSharedValue(0);
  const imageSource = getCharacterImageSource(player.characterId);

  // 어깨를 들썩이듯 좌우로 짧게 흔들린다
  useEffect(() => {
    sob.value = withDelay(
      index * 120,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 140 }),
          withTiming(-1, { duration: 140 }),
          withTiming(0, { duration: 420 }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(sob);
  }, [sob, index]);

  const sobStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sob.value * 5}deg` }, { translateY: Math.abs(sob.value) * 2 }],
  }));

  return (
    <View sx={{ alignItems: 'center', width: CRY_SIZE + spacing.MD }}>
      <Animated.View style={[{ width: CRY_SIZE, height: CRY_SIZE }, sobStyle]}>
        {imageSource !== null ? (
          <Image source={imageSource} sx={{ width: CRY_SIZE, height: CRY_SIZE }} resizeMode="contain" />
        ) : (
          <View sx={{ width: CRY_SIZE, height: CRY_SIZE, backgroundColor: colors.SECONDARY_400 }} />
        )}
        {EYE_X.map((ratio, eyeIndex) => (
          <Fragment key={ratio}>
            <PixelTear x={CRY_SIZE * ratio} delay={eyeIndex * 350} />
            <PixelTear x={CRY_SIZE * ratio} delay={eyeIndex * 350 + 350} />
          </Fragment>
        ))}
      </Animated.View>
      {/* 발밑 눈물 웅덩이 */}
      <View sx={{ width: CRY_SIZE * 0.8, height: 4, backgroundColor: colors.INFO_300, opacity: 0.6 }} />
      <Text sx={{ ...textSizes.B4, color: colors.INFO_200, marginTop: 2 }}>엉엉</Text>
      <Text sx={{ fontFamily: fontFamily.REGULAR, fontSize: 11, color: colors.LIGHT_100 }} numberOfLines={1}>
        {player.nickname}
      </Text>
      <Text sx={{ ...textSizes.B4, color: colors.GRAY }}>{player.score}점</Text>
    </View>
  );
}

function StageCharacter({ player, index, size }: { player: PenaltyAwardPlayer; index: number; size: number }) {
  const hop = useSharedValue(0);
  const dimmed = player.left || player.waiting === true;
  const imageSource = getCharacterImageSource(player.characterId);

  // 단상 위에서 다 같이 신나서 통통 뛴다
  useEffect(() => {
    if (dimmed) return undefined;
    hop.value = withDelay(
      index * 110,
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 260, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 300 }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(hop);
  }, [hop, index, dimmed]);

  const hopStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hop.value }] }));

  return (
    <View sx={{ alignItems: 'center', width: size + spacing.MD }}>
      <Animated.View style={hopStyle}>
        {imageSource !== null ? (
          <Image
            source={imageSource}
            sx={{ width: size, height: size, opacity: dimmed ? 0.35 : 1 }}
            resizeMode="contain"
          />
        ) : (
          <View sx={{ width: size, height: size, backgroundColor: colors.SECONDARY_400, opacity: dimmed ? 0.35 : 1 }} />
        )}
      </Animated.View>
      <Text
        sx={{ fontFamily: fontFamily.REGULAR, fontSize: 10, color: dimmed ? colors.GRAY : colors.LIGHT_100 }}
        numberOfLines={1}
      >
        {player.nickname}
      </Text>
      <Text sx={{ ...textSizes.B4, color: dimmed ? colors.GRAY : colors.ACCENT_300 }}>{player.score}점</Text>
    </View>
  );
}

/** 벌칙 방 시상식 — 꼴찌가 아닌 사람은 한 단상에 모이고, 걸린 사람은 무대 밖에서 운다. */
export function PenaltyAward({ text, safePlayers, losers }: Props) {
  const gameId = useGameStore(s => s.result?.gameId);
  useEffect(() => {
    if (!gameId) return;
    const cheerTimer = setTimeout(() => playFeedback('podiumWinner', { key: `${gameId}:penalty:safe` }), 150);
    const loserTimer = setTimeout(() => playFeedback('gameover', { key: `${gameId}:penalty:loser` }), 1900);
    return () => {
      clearTimeout(cheerTimer);
      clearTimeout(loserTimer);
    };
  }, [gameId]);

  const characterSize = getStageCharacterSize(safePlayers.length);

  return (
    <View sx={{ flex: 1, paddingHorizontal: spacing.MD, paddingBottom: spacing.MD, gap: spacing.MD }}>
      {/* 벌칙 내용 */}
      <View sx={{ marginTop: spacing.SM }}>
        <PixelFrame borderColor={colors.WARNING_300} borderWidth={2} style={StyleSheet.absoluteFill}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.BLACK }]} />
        </PixelFrame>
        <View sx={{ alignItems: 'center', paddingVertical: spacing.SM, paddingHorizontal: spacing.MD }}>
          <Text variants={['bold', 'B3']} sx={{ color: colors.WARNING_300 }}>
            오늘의 벌칙
          </Text>
          <Text sx={{ ...textSizes.B1, color: colors.LIGHT_100, textAlign: 'center' }}>{text}</Text>
        </View>
      </View>

      {/* 단상 — 꼴찌가 아닌 사람 전원 */}
      <View sx={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View sx={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end' }}>
          {safePlayers.map((p, i) => (
            <StageCharacter key={p.userId} player={p} index={i} size={characterSize} />
          ))}
        </View>
        <View sx={{ alignSelf: 'stretch', marginTop: spacing.XS }}>
          <View sx={{ height: 8, backgroundColor: colors.WARNING_300, marginHorizontal: spacing.SM }} />
          <View
            sx={{ height: 22, backgroundColor: colors.WARNING_500, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text variants={['bold', 'B4']} sx={{ color: colors.BLACK }}>
              무사 통과!
            </Text>
          </View>
        </View>
      </View>

      {/* 무대 밖 — 걸린 사람 */}
      <View sx={{ alignItems: 'center', gap: spacing.XS }}>
        <Text variants={['bold', 'B3']} sx={{ color: colors.ERROR_400 }}>
          벌칙 당첨
        </Text>
        <View sx={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
          {losers.map((p, i) => (
            <CryingCharacter key={p.userId} player={p} index={i} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tear: {
    position: 'absolute',
    width: TEAR_SIZE,
    height: TEAR_SIZE + 2,
    backgroundColor: colors.INFO_200,
  },
});
