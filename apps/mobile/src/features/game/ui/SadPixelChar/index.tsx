import { useEffect } from 'react';
import { Text, View } from 'dripsy';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native';
import { colors, fontFamily } from '@/shared/config';

// 팡 등장 → 1.8s 유지 → 팡 퇴장
const HOLD_MS = 1800;

// 우울한 느낌 — 보라색 @ 글자들이 원형 궤도를 느리게 돈다
const GLYPH_COUNT = 8;
const ORBIT_RADIUS = 46;
const SPIN_MS = 7000;

const GLYPHS = Array.from({ length: GLYPH_COUNT }, (_, i) => {
  const t = i / GLYPH_COUNT;
  return {
    angle: t * 360,
    // 링을 따라 진하고 옅음이 반복되는 우중충한 명암
    opacity: 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI)),
  };
});

export function SadPixelChar() {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.3, { damping: 4, stiffness: 500 }),
      withSpring(1.0, { damping: 12, stiffness: 200 }),
    );
    opacity.value = withTiming(1, { duration: 100 });
    spin.value = withRepeat(withTiming(360, { duration: SPIN_MS, easing: Easing.linear }), -1, false);

    const exit = setTimeout(() => {
      scale.value = withTiming(0, { duration: 250 });
      opacity.value = withTiming(0, { duration: 250 });
    }, HOLD_MS);

    return () => clearTimeout(exit);
  }, [scale, opacity, spin]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${spin.value}deg` }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.container, animStyle]} pointerEvents="none">
      {GLYPHS.map((glyph) => (
        <View
          key={glyph.angle}
          sx={{
            position: 'absolute',
            transform: [{ rotate: `${glyph.angle}deg` }, { translateY: -ORBIT_RADIUS }],
          }}
        >
          <Text
            sx={{
              fontFamily: fontFamily.REGULAR,
              fontSize: 26,
              color: colors.SECONDARY_300,
              opacity: glyph.opacity,
            }}
          >
            @
          </Text>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
