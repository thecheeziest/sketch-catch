import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

type Props = {
  progress: SharedValue<number>;
  children?: ReactNode;
};

// 덮개가 화면을 완전히 가린 동안에만 가운데에 로딩·오류 안내를 띄운다
export function CoverStatus({ progress, children }: Props) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.85, 1, 1.15], [0, 1, 0], Extrapolation.CLAMP),
  }));
  if (!children) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.center, style]} pointerEvents="box-none">
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
