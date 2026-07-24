import { Text } from 'dripsy';
import { useEffect } from 'react';
import { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { StyleSheet } from 'react-native';
import { colors, fontFamily, textSizes } from '@/shared/config';
import { PixelExplosion } from '../PixelExplosion';

type Props = {
  visible: boolean;
};

// 정답 시 ScoreFeedback(+점수)에 대응하는 오답 피드백 — Alert 대신 화면 중앙 노출
export function WrongAnswerFeedback({ visible }: Props) {
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  useEffect(() => {
    if (!visible) return;
    scale.value = 0.6;
    opacity.value = 1;
    scale.value = withSequence(
      withTiming(1.15, { duration: 120 }),
      withTiming(1, { duration: 120 }),
    );
    opacity.value = withTiming(0, { duration: 800 });
  }, [visible, scale, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={styles.container} pointerEvents="none">
      <PixelExplosion />
      <Animated.View style={animatedStyle}>
        <Text
          sx={{
            ...textSizes.T1,
            fontFamily: fontFamily.BOLD,
            color: colors.ERROR_300,
          }}
        >
          오답입니다!
        </Text>
      </Animated.View>
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
