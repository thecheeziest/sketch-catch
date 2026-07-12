import { useEffect, useState } from 'react';
import { Text, View } from 'dripsy';
import { colors, fontFamily, spacing, textSizes } from '@/shared/config';

type Props = {
  text: string;
  timerSec?: number;
};

export function ReviewProgressHeader({ text, timerSec }: Props) {
  const [timeLeft, setTimeLeft] = useState(timerSec ?? 0);

  useEffect(() => {
    if (timerSec === undefined) return;
    setTimeLeft(timerSec);
    const id = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [timerSec]);

  const isUrgent = timerSec !== undefined && timeLeft <= 10;

  return (
    <View
      sx={{
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.MD,
        backgroundColor: colors.DARK_300,
      }}
    >
      <Text sx={{ ...textSizes.B2, fontFamily: fontFamily.BOLD, color: colors.LIGHT_100 }}>{text}</Text>
      {timerSec !== undefined && (
        <Text
          sx={{
            ...textSizes.B2,
            fontFamily: fontFamily.BOLD,
            color: isUrgent ? colors.WARNING_300 : colors.LIGHT_100,
          }}
        >
          {timeLeft}
        </Text>
      )}
    </View>
  );
}
