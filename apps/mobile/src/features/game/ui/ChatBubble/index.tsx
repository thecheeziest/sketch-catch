import { Text, View } from 'dripsy';
import { useEffect } from 'react';
import { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { colors, textSizes } from '@/shared/config';
import { PixelFrame } from '@/shared/ui/PixelFrame';

type Props = {
  text: string;
  isCorrect: boolean;
  onExpire: () => void;
};

export function ChatBubble({ text, isCorrect, onExpire }: Props) {
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  useEffect(() => {
    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(onExpire)();
        }
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, [opacity, onExpire]);

  const bgColor = isCorrect ? colors.ACCENT_100 : colors.LIGHT_100;
  const borderColor = isCorrect ? colors.ACCENT_300 : colors.DARK_200;

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          position: 'absolute',
          bottom: '100%',
          left: 0,
          right: 0,
          alignItems: 'center',
          zIndex: 10,
        },
      ]}
    >
      <View style={{ maxWidth: '60%' }}>
        <PixelFrame borderColor={borderColor}>
          <View sx={{ backgroundColor: bgColor, paddingHorizontal: 6, paddingVertical: 3 }}>
            <Text sx={{ ...textSizes.B3, color: colors.DARK_400 }}>{text}</Text>
          </View>
        </PixelFrame>
      </View>
    </Animated.View>
  );
}
