import { useEffect, useState } from 'react';
import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import { colors, fontFamily, spacing, textSizes } from '@/shared/config';
import { Icon } from '@/shared/ui/Icon';

type Props = {
  roundIndex: number;
  totalTurns: number;
  isDrawer: boolean;
  word: string | null;
  promptHint: string | null;
  durationSec: number;
  onBack: () => void;
};

export function GameHeader({ roundIndex, totalTurns, isDrawer, word, promptHint, durationSec, onBack }: Props) {
  const [timeLeft, setTimeLeft] = useState(durationSec);

  useEffect(() => {
    setTimeLeft(durationSec);
    const id = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [roundIndex, durationSec]);

  const wordDisplay = isDrawer ? word : promptHint;
  const isUrgent = timeLeft <= 10;

  return (
    <View>
      {/* ① 라운드 안내 바 */}
      <View style={styles.roundStrip}>
        <View style={styles.side}>
          <Icon name="BACK" size={24} onPress={onBack} />
        </View>
        <Text sx={{ ...textSizes.B2, color: colors.LIGHT_100, fontFamily: fontFamily.BOLD }}>
          {`ROUND ${roundIndex + 1}  (${roundIndex + 1}/${totalTurns})`}
        </Text>
        <View style={styles.side} />
      </View>

      {/* ② 문제 정보 + 타이머 */}
      <View style={styles.wordRow}>
        <Text
          sx={{
            flex: 1,
            fontFamily: 'Galmuri11',
            ...textSizes.T2,
            color: isDrawer ? colors.PRIMARY_400 : colors.LIGHT_100,
            letterSpacing: 2,
          }}
          numberOfLines={1}
        >
          {wordDisplay ?? ''}
        </Text>
        <Text
          style={[styles.timer, isUrgent && styles.timerUrgent]}
        >
          {timeLeft}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  roundStrip: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.MD,
    backgroundColor: colors.DARK_300,
  },
  side: {
    width: 40,
    alignItems: 'flex-start',
  },
  wordRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.MD,
    backgroundColor: colors.DARK_200,
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
    color: colors.ERROR_300,
  },
});
