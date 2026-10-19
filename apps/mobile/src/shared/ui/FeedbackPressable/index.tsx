import { type ComponentRef, type Ref } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { type FeedbackName } from '@/shared/config/audio';
import { playFeedback } from '@/shared/lib/feedback';

export type FeedbackPressableProps = PressableProps & {
  feedback?: FeedbackName | false;
  pressScale?: number;
  ref?: Ref<ComponentRef<typeof Pressable>>;
};

export function FeedbackPressable({
  onPress,
  feedback = 'select',
  pressScale,
  style,
  ...props
}: FeedbackPressableProps) {
  return (
    <Pressable
      {...props}
      style={state => [
        typeof style === 'function' ? style(state) : style,
        state.pressed && pressScale !== undefined && { transform: [{ scale: pressScale }] },
      ]}
      onPress={event => {
        if (props.disabled || !onPress) return;
        if (feedback) playFeedback(feedback);
        onPress(event);
      }}
    />
  );
}
