import { useEffect, useRef } from 'react';
import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import type { RoundEnd, Player } from '@sketch-catch/shared';
import { colors, fontFamily, textSizes, spacing } from '@/shared/config';
import { PixelFireworks } from '../PixelFireworks';
import { SadPixelChar } from '../SadPixelChar';

type Props = {
  result: RoundEnd;
  players: Player[];
  prompt: string | null;
  onDismiss: () => void;
};

const DISMISS_MS = 3000;

export function TurnEndOverlay({ result, players, prompt, onDismiss }: Props) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [result.roundIndex]);

  const isCorrect = result.correctUserId != null;
  const correctNickname = players.find((p) => p.id === result.correctUserId)?.nickname ?? '';

  return (
    <View style={styles.overlay}>
      {isCorrect && <PixelFireworks />}

      <View sx={{ alignItems: 'center', gap: spacing.MD, paddingHorizontal: spacing.LG }}>
        {!isCorrect && <SadPixelChar />}

        <Text
          sx={{
            ...textSizes.T1,
            fontFamily: fontFamily.BOLD,
            color: isCorrect ? colors.ACCENT_300 : colors.ERROR_300,
            textAlign: 'center',
          }}
        >
          {isCorrect ? correctNickname + '! PERFECT!' : '앗! GAME OVER….'}
        </Text>

        {prompt != null && (
          <Text
            sx={{
              ...textSizes.B1,
              fontFamily: fontFamily.REGULAR,
              color: colors.LIGHT_100,
              textAlign: 'center',
            }}
          >
            {isCorrect ? prompt + ' 정답입니다!' : '정답은 ' + prompt + '!'}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    // DARK_400(#0C0A16)에 opacity 0.92
    backgroundColor: 'rgba(12, 10, 22, 0.92)',
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
