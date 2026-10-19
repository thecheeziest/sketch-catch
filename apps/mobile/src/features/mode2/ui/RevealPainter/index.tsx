import { useEffect } from 'react';
import { Image, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { BRUSH_SPRITE, PALETTE_SPRITE } from '@sketch-catch/shared';
import { getCharacterImageSource } from '@/shared/config';
import { makeStepEasing } from '@/shared/lib/stepEasing';
import { PixelSprite } from '@/shared/ui/PixelSprite';
import { playerRing } from '@/features/game/config';

type Props = {
  characterId: string | null;
  size?: number;
};

const SWAY_PX = 8;
const SWAY_MS = 700;
const STROKE_MS = 180;

// 공개식 원조자 — 왼손 팔레트, 오른손 붓을 들고 좌우로 오가며 그림 그리는 시늉을 한다
export function RevealPainter({ characterId, size = 52 }: Props) {
  const reduced = useReducedMotion();
  const sway = useSharedValue(0);
  const brush = useSharedValue(0);

  useEffect(() => {
    if (reduced) return undefined;
    sway.value = -SWAY_PX;
    sway.value = withRepeat(withTiming(SWAY_PX, { duration: SWAY_MS, easing: makeStepEasing(4) }), -1, true);
    // 붓은 더 빠르게 샤샥 — 짧게 두 번 긋고 쉬는 박자
    brush.value = withRepeat(
      withSequence(
        withTiming(-18, { duration: STROKE_MS }),
        withTiming(12, { duration: STROKE_MS }),
        withTiming(-18, { duration: STROKE_MS }),
        withTiming(0, { duration: STROKE_MS * 2 }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(sway);
      cancelAnimation(brush);
    };
  }, [reduced, sway, brush]);

  const swayStyle = useAnimatedStyle(() => ({ transform: [{ translateX: sway.value }] }));
  const brushStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${brush.value}deg` }] }));
  const imageSource = characterId ? getCharacterImageSource(characterId) : null;

  return (
    <Animated.View style={[styles.row, swayStyle]}>
      <PixelSprite sprite={PALETTE_SPRITE} pixelSize={3} />
      {imageSource !== null ? (
        <Image source={imageSource} sx={{ width: size, height: size }} resizeMode="contain" />
      ) : (
        <View sx={{ width: size, height: size, backgroundColor: playerRing.IDLE }} />
      )}
      <Animated.View style={[styles.brush, brushStyle]}>
        <PixelSprite sprite={BRUSH_SPRITE} pixelSize={3} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'center',
    gap: 4,
  },
  // 붓 손잡이 끝(아래)을 축으로 흔든다
  brush: {
    transformOrigin: 'bottom',
  },
});
