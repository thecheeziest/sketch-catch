import { type ReactNode, useEffect, useState } from 'react';
import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import { colors, fontFamily, spacing, textSizes } from '@/shared/config';
import { Icon } from '@/shared/ui/Icon';
import { gameSurface, gameText, legendSwatch } from '@/features/game/config';

type Props = {
  roundIndex: number;
  totalTurns: number;
  isDrawer: boolean;
  word: string | null;
  promptHint: string | null;
  durationSec: number;
  playerCount: number;
  maxPlayers: number;
  /** 정답 공개 — 라운드가 정답으로 종료되면 역할 무관하게 실제 제시어를 초록색으로 노출 */
  revealedWord?: string | null;
  /** 범례 라인 오른쪽 끝 슬롯 (예: 정답 인정 버튼) */
  legendAction?: ReactNode;
  onBack: () => void;
};

function getWordColor(revealed: boolean, isDrawer: boolean): string {
  if (revealed) return legendSwatch.SOLVED;
  if (isDrawer) return gameText.WORD;
  return gameText.PRIMARY;
}

const LEGEND = [
  { color: legendSwatch.DRAWER, label: '출제자' },
  { color: legendSwatch.SOLVED, label: '정답' },
  { color: legendSwatch.GUESSING, label: '추측중' },
] as const;

export function GameHeader({
  roundIndex,
  totalTurns,
  isDrawer,
  word,
  promptHint,
  durationSec,
  playerCount,
  maxPlayers,
  revealedWord = null,
  legendAction,
  onBack,
}: Props) {
  const [timeLeft, setTimeLeft] = useState(durationSec);

  useEffect(() => {
    setTimeLeft(durationSec);
    const id = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [roundIndex, durationSec]);

  const wordDisplay = revealedWord ?? (isDrawer ? word : promptHint);
  const wordColor = getWordColor(revealedWord != null, isDrawer);
  const isUrgent = timeLeft <= 10;

  return (
    <View sx={{ backgroundColor: gameSurface.PANEL }}>
      {/* ① 라운드 스트립 + 인원 카운터 */}
      <View style={styles.roundStrip}>
        <Icon name="BACK" size={18} color={gameText.PRIMARY} onPress={onBack} />
        <Text sx={{ ...textSizes.B2, color: gameText.PRIMARY, fontFamily: fontFamily.BOLD, letterSpacing: 1 }}>
          {`ROUND ${roundIndex + 1} (${roundIndex + 1}/${totalTurns})`}
        </Text>
        <Text sx={{ marginLeft: 'auto', ...textSizes.B3, color: gameText.MUTED, fontFamily: fontFamily.BOLD }}>
          {`${playerCount}/${maxPlayers}`}
        </Text>
      </View>

      {/* ② 제시어 + 타이머 */}
      <View style={styles.wordRow}>
        <Text
          sx={{
            flex: 1,
            fontFamily: fontFamily.REGULAR,
            fontSize: 25,
            lineHeight: 30,
            color: wordColor,
            letterSpacing: 2,
          }}
          numberOfLines={1}
        >
          {wordDisplay ?? ''}
        </Text>
        <Text style={[styles.timer, isUrgent && styles.timerUrgent]}>{timeLeft}</Text>
      </View>

      {/* ③ 상태 범례 (+ 오른쪽 끝 액션 슬롯) */}
      <View style={styles.legendRow}>
        {LEGEND.map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
            <Text sx={{ fontFamily: fontFamily.REGULAR, fontSize: 11, color: gameText.MUTED }}>{item.label}</Text>
          </View>
        ))}
        {legendAction != null && <View sx={{ marginLeft: 'auto' }}>{legendAction}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  roundStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.MD,
    paddingVertical: 13,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.MD,
    paddingVertical: spacing.SM,
  },
  timer: {
    fontFamily: fontFamily.BOLD,
    fontSize: 23,
    lineHeight: 30,
    color: gameText.PRIMARY,
    minWidth: 36,
    textAlign: 'right',
  },
  timerUrgent: {
    color: colors.ERROR_300,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 26,
    paddingHorizontal: spacing.MD,
    paddingBottom: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 8,
    height: 8,
  },
});
