import { type ReactNode } from 'react';
import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import { colors, fontFamily, spacing, textSizes } from '@/shared/config';
import { Icon } from '@/shared/ui/Icon';
import { gameSurface, gameText, legendSwatch } from '@/features/game/config';
import { Collapse } from '../Collapse';
import { WordBar } from '../WordBar';

type Props = {
  roundIndex: number;
  totalTurns: number;
  timeLeft: number;
  /** 없으면 참가자 그리드·상태 범례를 숨긴다 (모드 2) */
  playerGrid?: ReactNode;
  word: string | null;
  wordColor: string;
  /** 키보드가 올라온 동안 라운드 바·참가자 리스트·범례를 접어 스케치북 영역을 확보한다 */
  collapsed: boolean;
  playerCount: number;
  maxPlayers: number;
  /** 범례 라인 오른쪽 끝 슬롯 (예: 정답 인정 버튼) */
  legendAction?: ReactNode;
  /** 제시어 바의 남은 시간 오른쪽 슬롯 (예: 모드 2 제출 버튼) */
  wordAction?: ReactNode;
  wordActionWidth?: number;
  onBack: () => void;
};

// WordBar 기본 좌우 슬롯 폭 — 남은 시간 숫자 자리
const TIMER_SLOT_WIDTH = 40;

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
  word,
  wordColor,
  collapsed,
  playerCount,
  maxPlayers,
  legendAction,
  wordAction,
  wordActionWidth = 0,
  onBack,
}: Props) {
  const isUrgent = timeLeft <= 10;

  return (
    <View sx={{ backgroundColor: gameSurface.PANEL }}>
      <Collapse collapsed={collapsed}>
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
      </Collapse>

      <WordBar
        word={word}
        color={wordColor}
        sideWidth={TIMER_SLOT_WIDTH + wordActionWidth}
        right={
          <>
            <Text style={[styles.timer, isUrgent && styles.timerUrgent]}>{timeLeft}</Text>
            {wordAction}
          </>
        }
      />

      {playerGrid != null && (
        <Collapse collapsed={collapsed}>
          {playerGrid}

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
        </Collapse>
      )}
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
  timer: {
    fontFamily: fontFamily.BOLD,
    fontSize: 23,
    lineHeight: 30,
    color: gameText.PRIMARY,
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
