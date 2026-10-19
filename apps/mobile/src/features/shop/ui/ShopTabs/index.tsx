import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import type { ShopCategory } from '@sketch-catch/shared';
import { colors, fontFamily, spacing } from '@/shared/config';
import { FeedbackPressable } from '@/shared/ui/FeedbackPressable';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { SHOP_TABS } from '../../lib/useShopScreen';

type Props = {
  active: ShopCategory;
  onChange: (category: ShopCategory) => void;
};

export function ShopTabs({ active, onChange }: Props) {
  return (
    <View sx={{ flexDirection: 'row', gap: spacing.SM, paddingHorizontal: spacing.MD }} accessibilityRole="tablist">
      {SHOP_TABS.map(tab => {
        const isActive = tab.category === active;
        return (
          <FeedbackPressable
            key={tab.category}
            onPress={() => onChange(tab.category)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={styles.tab}
          >
            <PixelFrame borderColor={colors.BLACK} borderWidth={2} notchSize={4} style={StyleSheet.absoluteFill}>
              <View
                style={[StyleSheet.absoluteFill, { backgroundColor: isActive ? colors.SECONDARY_300 : colors.DARK_100 }]}
              />
            </PixelFrame>
            <Text
              sx={{
                fontFamily: fontFamily.BOLD,
                fontSize: 14,
                lineHeight: 20,
                color: isActive ? colors.ACCENT_300 : colors.LIGHT_500,
              }}
            >
              {tab.label}
            </Text>
          </FeedbackPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
});
