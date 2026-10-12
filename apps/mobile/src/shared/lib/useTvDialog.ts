import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { playTvFeedback } from './tvFeedback';

export function useTvDialog(visible: boolean, onClose: () => void) {
  const [rendered, setRendered] = useState(visible);
  const [closing, setClosing] = useState(false);
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const scaleXAnim = useRef(new Animated.Value(0.05)).current;
  const scaleYAnim = useRef(new Animated.Value(0.02)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const phase = useRef<'hidden' | 'opening' | 'open' | 'closing'>('hidden');
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const cancelFeedback = useRef<(() => void) | null>(null);
  const transitionId = useRef(0);
  const onCloseRef = useRef(onClose);
  const visibleRef = useRef(visible);

  useEffect(() => {
    onCloseRef.current = onClose;
    visibleRef.current = visible;
  }, [onClose, visible]);

  const stopTransition = useCallback(() => {
    transitionId.current += 1;
    animation.current?.stop();
    animation.current = null;
    cancelFeedback.current?.();
    cancelFeedback.current = null;
  }, []);

  const close = useCallback(
    (notifyParent: boolean) => {
      if (phase.current === 'hidden' || phase.current === 'closing') return;
      stopTransition();
      const id = transitionId.current;
      phase.current = 'closing';
      setClosing(true);
      cancelFeedback.current = playTvFeedback('off');
      animation.current = Animated.parallel([
        Animated.timing(overlayAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(scaleYAnim, {
            toValue: 0.02,
            duration: 160,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scaleXAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
        ]),
      ]);
      animation.current.start(({ finished }) => {
        if (!finished || id !== transitionId.current) return;
        phase.current = 'hidden';
        animation.current = null;
        setRendered(false);
        setClosing(false);
        if (notifyParent && visibleRef.current) onCloseRef.current();
      });
    },
    [flashAnim, overlayAnim, scaleXAnim, scaleYAnim, stopTransition],
  );

  useEffect(() => {
    if (!visible) {
      close(false);
      return;
    }
    stopTransition();
    const id = transitionId.current;
    phase.current = 'opening';
    setRendered(true);
    setClosing(false);
    scaleXAnim.setValue(0.05);
    scaleYAnim.setValue(0.02);
    overlayAnim.setValue(0);
    flashAnim.setValue(0);
    cancelFeedback.current = playTvFeedback('on');
    animation.current = Animated.parallel([
      Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(scaleXAnim, {
          toValue: 1,
          duration: 90,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleYAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 0.85, duration: 60, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]),
    ]);
    animation.current.start(({ finished }) => {
      if (!finished || id !== transitionId.current) return;
      phase.current = 'open';
      animation.current = null;
    });
  }, [visible, close, flashAnim, overlayAnim, scaleXAnim, scaleYAnim, stopTransition]);

  useEffect(
    () => () => {
      phase.current = 'hidden';
      stopTransition();
    },
    [stopTransition],
  );

  const dismiss = useCallback(() => close(true), [close]);
  return { rendered, closing, dismiss, overlayAnim, scaleXAnim, scaleYAnim, flashAnim };
}
