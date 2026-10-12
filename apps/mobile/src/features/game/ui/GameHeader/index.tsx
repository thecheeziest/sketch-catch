import { type ReactNode } from 'react';
import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import { colors, fontFamily, spacing, textSizes } from '@/shared/config';
import { Icon } from '@/shared/ui/Icon';
import { gameSurface, gameText, legendSwatch } from '@/features/game/config';

type Props = {
  roundIndex: number;
  totalTurns: number;
  timeLeft: number;
  playerGrid: ReactNode;
  playerCount: number;
  maxPlayers: number;
  /** 범례 라인 오른쪽 끝 슬롯 (예: 정답 인정 버튼) */
  legendAction?: ReactNode;
  onBack: () => void;
};

const LEGEND = [
  { color: legendSwatch.DRAWER, label: '출제자' },
  { color: legendSwatch.SOLVED, label: '정답' },
  { color: legendSwatch.GUESSING, label: '추측중' },
] as const;

export function GameHeader({
  roundIndex,
  totalTurns,
  timeLeft,
  playerGrid,
  playerCount,
  maxPlayers,
  legendAction,
  onBack,
}: Props) {
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

      <View style={styles.playerRow}>
        <View sx={{ flex: 1 }}>{playerGrid}</View>
        <Text style={[styles.timer, isUrgent && styles.timerUrgent]}>{timeLeft}</Text>
      </View>

      {/* ③ 상태 범례 (+ 오른쪽 끝 액션 슬롯) */}
      <View style={styles.legendRow}>
        {LEGEND.map(item => (
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
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.MD,
  },
  timer: {
    fontFamily: fontFamily.BOLD,
    fontSize: 23,
    lineHeight: 30,
    color: gameText.PRIMARY,
    minWidth: 36,
    alignSelf: 'flex-start',
    marginTop: 3,
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
