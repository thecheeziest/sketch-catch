import { useEffect, useState } from 'react';
import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { Mode2Phase } from '@sketch-catch/shared';
import { colors, fontFamily, spacing, textSizes } from '@/shared/config';
import { Icon } from '@/shared/ui/Icon';

type Props = {
  stepIndex: number;
  totalSteps: number;
  phase: Mode2Phase;
  durationSec: number;
  onBack: () => void;
};

const PHASE_LABEL: Record<Mode2Phase, string> = {
  PROMPT: '글쓰기 중',
  DRAW: '그림 그리는 중',
  ANSWER: '정답 맞히는 중',
};

export function SheetRotationHeader({ stepIndex, totalSteps, phase, durationSec, onBack }: Props) {
  const [timeLeft, setTimeLeft] = useState(durationSec);
  const isUrgent = timeLeft <= 10;
  const blink = useSharedValue(1);

  useEffect(() => {
    setTimeLeft(durationSec);
    const id = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [stepIndex, durationSec]);

  useEffect(() => {
    if (isUrgent) {
      blink.value = withRepeat(withTiming(0.4, { duration: 500 }), -1, true);
    } else {
      cancelAnimation(blink);
      blink.value = 1;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUrgent]);

  const timerAnimatedStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  return (
    <View>
      {/* ① 단계 안내 바 */}
      <View style={styles.strip}>
        <View style={styles.side}>
          <Icon name="BACK" size={24} onPress={onBack} />
        </View>
        <Text
          sx={{ flex: 1, ...textSizes.B2, color: colors.LIGHT_100, fontFamily: fontFamily.BOLD }}
        >
          {`단계 ${stepIndex + 1}/${totalSteps}`}
        </Text>
        <Text sx={{ ...textSizes.B3, color: colors.GRAY }}>{PHASE_LABEL[phase]}</Text>
      </View>

      {/* ② 단계 도트 + 타이머 */}
      <View style={styles.timerRow}>
        <View style={styles.dots}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === stepIndex ? colors.PRIMARY_400 : colors.DARK_100 },
              ]}
            />
          ))}
        </View>
        <Animated.Text
          style={[styles.timer, isUrgent && styles.timerUrgent, timerAnimatedStyle]}
        >
          {timeLeft}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.MD,
    backgroundColor: colors.DARK_300,
    gap: spacing.SM,
  },
  side: {
    width: 40,
    alignItems: 'flex-start',
  },
  timerRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.MD,
    backgroundColor: colors.DARK_200,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timer: {
    fontFamily: fontFamily.BOLD,
    fontSize: 22,
    lineHeight: 30,
    color: colors.LIGHT_100,
    minWidth: 36,
    textAlign: 'right',
  },
  timerUrgent: {
    color: colors.WARNING_300,
  },
});
