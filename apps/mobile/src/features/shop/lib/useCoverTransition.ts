import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type EasingFunction,
  type SharedValue,
} from 'react-native-reanimated';
import { playFeedback } from '@/shared/lib/feedback';

// 커튼·코인 전환 컴포넌트 공통 props
export type CoverTransitionProps = {
  startCovered?: boolean;
  ready?: boolean;
  onCovered?: () => void;
  onDone: () => void;
  children?: ReactNode; // 덮여 있는 동안 가운데에 띄울 로딩·오류 안내
};

type Options = {
  sound: 'coins' | 'curtain';
  coverMs: number;
  holdMs: number;
  revealMs: number;
  coverEasing?: EasingFunction;
  revealEasing?: EasingFunction;
  /** true면 덮인 상태(progress 1)로 시작한다 — 진입 로딩용 */
  startCovered?: boolean;
  /** false인 동안은 덮인 채로 기다리고, true가 되면 걷기 시작한다 */
  ready?: boolean;
  onCovered?: () => void; // 화면이 완전히 가려진 순간 — 여기서 뷰를 바꾼다
  onDone: () => void;
};

/**
 * 화면을 덮었다가 걷는 전환 타임라인. progress는 0→1(덮기) → 1→2(걷기)로 흐른다.
 * 덮인 뒤 ready가 될 때까지 기다리며, 동작 줄이기 설정이면 애니메이션 없이 바로 넘어간다.
 */
export function useCoverTransition({
  sound,
  coverMs,
  holdMs,
  revealMs,
  coverEasing = Easing.linear,
  revealEasing = Easing.linear,
  startCovered = false,
  ready = true,
  onCovered,
  onDone,
}: Options): SharedValue<number> {
  const progress = useSharedValue(startCovered ? 1 : 0);
  const reducedMotion = useReducedMotion();
  const [covered, setCovered] = useState(startCovered);
  const revealing = useRef(false);
  // 재생 도중 부모가 다시 렌더돼도 타임라인을 다시 시작하지 않도록 최신 콜백만 참조한다
  const callbacks = useRef({ onCovered, onDone });
  callbacks.current = { onCovered, onDone };

  const stopSound = useRef<(() => void) | undefined>(undefined);
  const soundRevealed = useRef(false);
  const mounted = useRef(false);
  const playReveal = (): void => {
    if (!mounted.current || soundRevealed.current || reducedMotion) return;
    soundRevealed.current = true;
    stopSound.current?.();
    stopSound.current = playFeedback(sound === 'coins' ? 'coinRainTail' : 'curtainOpen');
  };
  // 로딩·hold 시간이 아닌 UI 스레드의 실제 걷기 시작에 맞춘다.
  useAnimatedReaction(
    () => progress.value > 1,
    (started, previous) => {
      if (started && !previous) runOnJS(playReveal)();
    },
  );

  useEffect(() => {
    mounted.current = true;
    if (!reducedMotion && (sound === 'coins' || !startCovered)) {
      stopSound.current = playFeedback(sound === 'coins' ? 'coinRain' : 'curtainClose');
    }
    return () => {
      mounted.current = false;
      stopSound.current?.();
      cancelAnimation(progress);
    };
    // 전환 인스턴스 수명에 맞춰 재생·정리한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (startCovered) return;
    const markCovered = (): void => {
      callbacks.current.onCovered?.();
      setCovered(true);
    };
    if (reducedMotion) {
      markCovered();
      return;
    }
    progress.value = withTiming(1, { duration: coverMs, easing: coverEasing }, finished => {
      if (finished) runOnJS(markCovered)();
    });
    // 마운트 1회 재생 전용
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!covered || !ready || revealing.current) return;
    revealing.current = true;
    const done = (): void => {
      stopSound.current?.();
      callbacks.current.onDone();
    };
    if (reducedMotion) {
      done();
      return;
    }
    progress.value = withDelay(
      holdMs,
      withTiming(2, { duration: revealMs, easing: revealEasing }, revealed => {
        if (revealed) runOnJS(done)();
      }),
    );
    // 덮임·준비 완료가 처음 겹치는 순간 한 번만 걷는다 (이후 ready가 흔들려도 다시 시작하지 않음)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [covered, ready]);

  return progress;
}
