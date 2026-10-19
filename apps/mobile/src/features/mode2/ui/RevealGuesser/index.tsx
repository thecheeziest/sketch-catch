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
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BULB_SPRITE, QUESTION_SPRITE } from '@sketch-catch/shared';
import { getCharacterImageSource } from '@/shared/config';
import { PixelSprite } from '@/shared/ui/PixelSprite';
import { playerRing } from '@/features/game/config';
import { PixelSpeechBubble } from '../PixelSpeechBubble';

type Props = {
  characterId: string;
  text: string;
  icon: 'question' | 'bulb';
  size?: number;
};

const RAY_COLOR = '#FFE066';

// 추측 중 — 물음표가 갸웃거리며 통통 튄다
function QuestionMark({ reduced }: { reduced: boolean }) {
  const bob = useSharedValue(0);
  useEffect(() => {
    if (reduced) return undefined;
    bob.value = withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0, { duration: 320 })), -1);
    return () => cancelAnimation(bob);
  }, [reduced, bob]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -5 * bob.value }, { rotate: `${-12 + 24 * bob.value}deg` }],
  }));
  return (
    <Animated.View style={style}>
      <PixelSprite sprite={QUESTION_SPRITE} pixelSize={3} />
    </Animated.View>
  );
}

// 떠올랐다 — 전구가 톡 튀어나오고 빛줄기가 깜빡인다
function LightBulb({ reduced }: { reduced: boolean }) {
  const pop = useSharedValue(reduced ? 1 : 0);
  const glow = useSharedValue(1);
  useEffect(() => {
    if (reduced) return undefined;
    pop.value = withSpring(1, { damping: 7, stiffness: 220 });
    glow.value = withRepeat(withSequence(withTiming(0.2, { duration: 260 }), withTiming(1, { duration: 260 })), -1);
    return () => {
      cancelAnimation(pop);
      cancelAnimation(glow);
    };
  }, [reduced, pop, glow]);
  const bulbStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const rayStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  return (
    <Animated.View style={bulbStyle}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, rayStyle]}>
        <View style={[styles.ray, styles.rayTop]} />
        <View style={[styles.ray, styles.rayLeft]} />
        <View style={[styles.ray, styles.rayRight]} />
      </Animated.View>
      <PixelSprite sprite={BULB_SPRITE} pixelSize={3} />
    </Animated.View>
  );
}

// 공개식 맞히는 사람 — 스케치북 아래에서 말풍선으로 추측을 말하고, 옆에 ?? / 전구가 반응한다
export function RevealGuesser({ characterId, text, icon, size = 48 }: Props) {
  const reduced = useReducedMotion();
  const imageSource = getCharacterImageSource(characterId);

  return (
    <View sx={{ alignItems: 'center', gap: 12 }}>
      <PixelSpeechBubble text={text} tail="down" />
      <View sx={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {/* 아이콘 폭만큼 왼쪽을 비워 캐릭터를 가운데에 둔다 */}
        <View sx={{ width: 27 }} />
        {imageSource !== null ? (
          <Image source={imageSource} sx={{ width: size, height: size }} resizeMode="contain" />
        ) : (
          <View sx={{ width: size, height: size, backgroundColor: playerRing.IDLE }} />
        )}
        <View sx={{ width: 27, alignItems: 'center' }}>
          {icon === 'question' ? (
            <QuestionMark key="question" reduced={reduced} />
          ) : (
            <LightBulb key="bulb" reduced={reduced} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ray: {
    position: 'absolute',
    backgroundColor: RAY_COLOR,
  },
  rayTop: {
    top: -9,
    left: 12,
    width: 3,
    height: 6,
  },
  rayLeft: {
    top: 6,
    left: -9,
    width: 6,
    height: 3,
  },
  rayRight: {
    top: 6,
    right: -9,
    width: 6,
    height: 3,
  },
});
