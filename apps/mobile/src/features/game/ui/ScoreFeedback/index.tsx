import { Text } from 'dripsy';
import { useEffect } from 'react';
import { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { StyleSheet } from 'react-native';
import { colors, fontFamily, textSizes } from '@/shared/config';

type Props = {
  score: number;
  visible: boolean;
};

export function ScoreFeedback({ score, visible }: Props) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  useEffect(() => {
    if (!visible) return;
    translateY.value = 0;
    opacity.value = 1;
    translateY.value = withTiming(-40, { duration: 800 });
    opacity.value = withTiming(0, { duration: 800 });
  }, [visible, score, translateY, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="none">
      <Text
        sx={{
          ...textSizes.T1,
          fontFamily: fontFamily.BOLD,
          color: colors.ACCENT_300,
        }}
      >
        {'+' + score + '점'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
});
