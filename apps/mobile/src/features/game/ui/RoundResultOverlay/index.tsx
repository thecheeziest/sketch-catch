import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import type { RoundEnd } from '@sketch-catch/shared';
import type { Player } from '@sketch-catch/shared';
import { colors, textSizes, spacing } from '@/shared/config';
import { FlatList } from '@/shared/ui/FlatList';

type Props = {
  result: RoundEnd;
  players: Player[];
  scoreboard: Record<string, number>;
  prompt?: string;
  onDismiss: () => void;
};

type ScoreRow = {
  userId: string;
  nickname: string;
  delta: number;
  total: number;
};

const COUNTDOWN_SEC = 3;

export function RoundResultOverlay({ result, players, scoreboard, prompt, onDismiss }: Props) {
  const [remaining, setRemaining] = useState(COUNTDOWN_SEC);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    setRemaining(COUNTDOWN_SEC);

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDismissRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [result.roundIndex]);

  const rows: ScoreRow[] = players.map((p) => ({
    userId: p.id,
    nickname: p.nickname,
    delta: result.scoreDelta[p.id] ?? 0,
    total: scoreboard[p.id] ?? 0,
  }));

  return (
    <View style={styles.overlay}>
      <View sx={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.LG, gap: spacing.MD }}>
        <Text sx={{ ...textSizes.T3, color: colors.LIGHT_100, textAlign: 'center' }}>
          {'턴 ' + (result.roundIndex + 1) + ' 결과'}
        </Text>

        {result.correctUserId != null && prompt != null && (
          <Text sx={{ ...textSizes.B1, color: colors.LIGHT_100, textAlign: 'center' }}>
            {'제시어: ' + prompt}
          </Text>
        )}

        <FlatList
          data={rows}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => (
            <View sx={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.XS }}>
              <Text sx={{ ...textSizes.B1, color: colors.LIGHT_100, flex: 1 }}>{item.nickname}</Text>
              <Text sx={{ ...textSizes.B1, color: colors.ACCENT_300, marginRight: spacing.SM }}>
                {item.delta > 0 ? '+' + item.delta : String(item.delta)}
              </Text>
              <Text sx={{ ...textSizes.B3, color: colors.GRAY }}>{String(item.total)}</Text>
            </View>
          )}
        />

        <Text sx={{ ...textSizes.B3, color: colors.LIGHT_100, textAlign: 'center' }}>
          {remaining + '초 후 다음 턴 시작'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    // DARK_400(#0C0A16)에 opacity 0.9 → rgba(12, 10, 22, 0.92)
    backgroundColor: 'rgba(12, 10, 22, 0.92)',
    zIndex: 100,
  },
});
