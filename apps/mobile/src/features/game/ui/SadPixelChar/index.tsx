import { useEffect } from 'react';
import { Text } from 'dripsy';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native';
import { colors, fontFamily } from '@/shared/config';

// 팡 등장 → 1.8s 유지 → 팡 퇴장
const HOLD_MS = 1800;

export function SadPixelChar() {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.3, { damping: 4, stiffness: 500 }),
      withSpring(1.0, { damping: 12, stiffness: 200 }),
    );
    opacity.value = withTiming(1, { duration: 100 });

    const exit = setTimeout(() => {
      scale.value = withTiming(0, { duration: 250 });
      opacity.value = withTiming(0, { duration: 250 });
    }, HOLD_MS);

    return () => clearTimeout(exit);
  }, [scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.container, animStyle]} pointerEvents="none">
      <Text
        sx={{
          fontFamily: fontFamily.REGULAR,
          fontSize: 56,
          color: colors.LIGHT_300,
          textAlign: 'center',
        }}
      >
        {'( @_@ )'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
