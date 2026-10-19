import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import { COIN_SPRITE, colors, fontFamily } from '@/shared/config';
import { FeedbackPressable } from '../FeedbackPressable';
import { PixelFrame } from '../PixelFrame';
import { PixelSprite } from '../PixelSprite';

type Props = {
  label: string; // 보유 코인("260") 또는 획득량("+65")
  onPress?: () => void;
  accessibilityLabel: string;
  height?: number;
};

// 골드 테두리 코인 칩 — 홈 헤더(보유 코인)와 시상식·공개식 타이틀(획득 코인)에서 쓴다
export function CoinChip({ label, onPress, accessibilityLabel, height = 32 }: Props) {
  return (
    <FeedbackPressable
      onPress={onPress}
      disabled={!onPress}
      pressScale={0.95}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={[styles.chip, { height }]}
    >
      <PixelFrame borderColor={colors.WARNING_400} borderWidth={2} notchSize={4} style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_400 }]} />
      </PixelFrame>
      <View sx={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10 }}>
        <PixelSprite sprite={COIN_SPRITE} pixelSize={2} />
        <Text sx={{ fontFamily: fontFamily.BOLD, fontSize: 15, lineHeight: 20, color: colors.WARNING_400 }}>{label}</Text>
      </View>
    </FeedbackPressable>
  );
}

const styles = StyleSheet.create({
  chip: { justifyContent: 'center' },
});
