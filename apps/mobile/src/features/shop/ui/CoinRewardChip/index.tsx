import { useEffect, useState } from 'react';
import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { CoinReward } from '@sketch-catch/shared';
import { colors, fontFamily, spacing } from '@/shared/config';
import { CoinChip } from '@/shared/ui/CoinChip';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { getRewardLineLabel, isHighlightLine } from '../../lib/rewardLines';

type Props = {
  reward: CoinReward;
};

const AUTO_COLLAPSE_MS = 3000;

// 시상식·공개식 타이틀 옆 획득 코인 칩 — 정산이 도착하면 내역을 3초 펼쳤다 접고, 칩을 누르면 다시 펼친다
export function CoinRewardChip({ reward }: Props) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    setExpanded(true);
    const timer = setTimeout(() => setExpanded(false), AUTO_COLLAPSE_MS);
    return () => clearTimeout(timer);
  }, [reward.gameId]);

  return (
    <View style={styles.anchor}>
      <CoinChip
        label={`+${reward.total}`}
        height={28}
        onPress={() => setExpanded(prev => !prev)}
        accessibilityLabel={`이번 판 코인 ${reward.total}개 획득, 내역 ${expanded ? '접기' : '펼치기'}`}
      />
      {expanded && (
        <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(120)} style={styles.popover}>
          <PixelFrame borderColor={colors.WARNING_400} borderWidth={3} style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_400 }]} />
          </PixelFrame>
          <View sx={{ padding: spacing.MD, gap: spacing.SM }}>
            <Text sx={{ fontFamily: fontFamily.BOLD, fontSize: 15, lineHeight: 22, color: colors.WARNING_400 }}>
              이번 판 코인 +{reward.total}
            </Text>
            {reward.lines.map(line => {
              const highlight = isHighlightLine(line);
              return (
                <View key={line.reason} sx={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.SM }}>
                  <Text sx={{ fontSize: 13, color: highlight ? colors.WARNING_200 : colors.LIGHT_400 }}>
                    {getRewardLineLabel(line, reward.mode)}
                  </Text>
                  <Text sx={{ fontSize: 13, color: highlight ? colors.WARNING_200 : colors.LIGHT_100 }}>+{line.amount}</Text>
                </View>
              );
            })}
            {reward.capped && (
              <Text sx={{ fontSize: 11, color: colors.PRIMARY_200 }}>오늘 받을 수 있는 코인을 다 받았어요</Text>
            )}
            <Text sx={{ fontSize: 11, color: colors.GRAY }}>
              보유 {reward.balance} · 오늘 {reward.todayEarned}/{reward.dailyCap}
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { zIndex: 10, elevation: 10 },
  popover: { position: 'absolute', top: 38, left: 0, width: 230 },
});
