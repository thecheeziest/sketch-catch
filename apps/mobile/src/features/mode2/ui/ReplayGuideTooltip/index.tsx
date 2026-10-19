import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { FeedbackPressable } from '@/shared/ui/FeedbackPressable';
import { resultOverlay } from '@/features/game/config';
import { PixelSpeechBubble } from '../PixelSpeechBubble';

type Props = {
  onClose: () => void;
};

// 실시간 공개식이 끝나면 캐릭터 줄을 가리키며 다시 보기·저장 방법을 알려 준다. 탭하면 닫힌다.
export function ReplayGuideTooltip({ onClose }: Props) {
  const reduced = useReducedMotion();
  const bounce = useSharedValue(0);

  useEffect(() => {
    if (reduced) return undefined;
    bounce.value = withRepeat(withTiming(1, { duration: 450 }), -1, true);
    return () => cancelAnimation(bounce);
  }, [reduced, bounce]);

  const bounceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * bounce.value }] }));

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={[styles.wrap, bounceStyle]}>
      <FeedbackPressable feedback="cancel" onPress={onClose} accessibilityRole="button" accessibilityHint="안내 닫기">
        <PixelSpeechBubble
          tail="up"
          numberOfLines={3}
          background={resultOverlay.GOLD.BG}
          textColor={resultOverlay.GOLD.FG}
          text={'캐릭터를 누르면 발표식을 다시 볼 수 있어요!\n저장 아이콘으로 GIF도 저장해 보세요'}
        />
      </FeedbackPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
  },
});
