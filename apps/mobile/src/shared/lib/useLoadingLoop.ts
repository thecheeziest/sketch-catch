import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export function useLoadingLoop(animating: boolean, duration: number) {
  const initialReducedMotion = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const phase = useSharedValue(1);

  useEffect(() => {
    const motionSubscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const appSubscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => {
      motionSubscription.remove();
      appSubscription.remove();
    };
  }, []);

  useEffect(() => {
    cancelAnimation(phase);
    if (animating && foreground && !reducedMotion) {
      phase.value = 0;
      phase.value = withRepeat(
        withTiming(1, { duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
        -1,
        false,
        undefined,
        ReduceMotion.Never,
      );
    } else {
      // 모션 감소 시 완성된 그림을 유지한다. 백그라운드에서는 반복을 중지한다.
      phase.value = 1;
    }
    return () => cancelAnimation(phase);
  }, [animating, duration, foreground, phase, reducedMotion]);

  return phase;
}
