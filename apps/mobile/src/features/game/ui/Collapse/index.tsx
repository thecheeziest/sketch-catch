import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type Props = {
  collapsed: boolean;
  children: ReactNode;
};

type Phase = 'open' | 'animating' | 'closed';

const DURATION_MS = 220;

// 접힘 중에는 레이아웃 높이도 함께 줄어야 아래 스케치북이 그만큼 커진다 (투명도만으로는 높이가 안 줄어든다).
export function Collapse({ collapsed, children }: Props) {
  const [phase, setPhase] = useState<Phase>(collapsed ? 'closed' : 'open');
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const progress = useSharedValue(collapsed ? 0 : 1);
  const fullHeight = useSharedValue(0);
  const isFirstRun = useRef(true);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent): void => {
      const { height } = e.nativeEvent.layout;
      fullHeight.value = height;
      setMeasuredHeight(height);
    },
    [fullHeight],
  );

  const settle = useCallback((next: Phase): void => setPhase(next), []);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    // 아직 한 번도 펼쳐진 높이를 못 쟀다면 애니메이션 없이 상태만 맞춘다
    if (fullHeight.value <= 0) {
      progress.value = collapsed ? 0 : 1;
      setPhase(collapsed ? 'closed' : 'open');
      return;
    }
    setPhase('animating');
    progress.value = withTiming(
      collapsed ? 0 : 1,
      { duration: DURATION_MS, easing: Easing.inOut(Easing.cubic) },
      finished => {
        if (finished) runOnJS(settle)(collapsed ? 'closed' : 'open');
      },
    );
  }, [collapsed, fullHeight, progress, settle]);

  const clipStyle = useAnimatedStyle(() => ({ height: fullHeight.value * progress.value }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const outerStyle = {
    open: undefined,
    animating: [styles.clip, clipStyle],
    closed: styles.closed,
  }[phase];

  return (
    <Animated.View style={outerStyle} pointerEvents={phase === 'closed' ? 'none' : 'auto'}>
      <Animated.View
        style={phase === 'animating' ? [{ height: measuredHeight }, fadeStyle] : undefined}
        onLayout={phase === 'open' ? handleLayout : undefined}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  closed: { height: 0, overflow: 'hidden' },
});
