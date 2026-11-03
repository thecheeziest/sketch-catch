import { ScrollView, Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import type { Category, GameMode } from '@sketch-catch/shared';
import { colors, fontFamily, spacing } from '@/shared/config';
import { CATEGORY_LABEL } from '@/shared/config/room';
import { PixelFrame } from '../PixelFrame';

type Props = { mode: GameMode; categories: Category[] };

export function RoomInfoChips({ mode, categories }: Props) {
  const chips = [
    { key: 'mode', label: mode === 1 ? '맞혀 볼래?' : '이어 그리자!', color: colors.PRIMARY_100 },
    ...categories
      .filter(category => CATEGORY_LABEL[category])
      .map(category => ({ key: category, label: CATEGORY_LABEL[category], color: colors.SECONDARY_100 })),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.chips}
    >
      {chips.map(chip => (
        <View key={chip.key}>
          <PixelFrame borderColor={colors.DARK_100} borderWidth={1} notchSize={3} style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: chip.color }]} />
          </PixelFrame>
          <Text style={styles.label}>{chip.label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0 },
  chips: { gap: spacing.XS, paddingVertical: spacing.XS },
  label: {
    fontFamily: fontFamily.REGULAR,
    fontSize: 11,
    lineHeight: 16,
    color: colors.DARK_100,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
});
