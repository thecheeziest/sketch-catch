import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

type Props = {
  children?: ReactNode;
};

// BEST_REVEAL 카드 반짝임 — ScoreFeedback opacity/scale 패턴 재사용 (모드1 시상식 전용 연출은 재사용 금지, D-05)
export function SparkleBadge({ children }: Props) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.4, duration: 400, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.08, duration: 400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
      ]),
      { iterations: 2 },
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, scale]);

  return (
    <Animated.View style={[styles.wrapper, { opacity, transform: [{ scale }] }]}>{children}</Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
});
