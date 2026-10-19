import { useEffect, useState } from 'react';
import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import type { ShopItem } from '@sketch-catch/shared';
import { colors, spacing } from '@/shared/config';
import { Dialog } from '@/shared/ui/Dialog';
import { FeedbackPressable } from '@/shared/ui/FeedbackPressable';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { SHOP_TABS } from '../../lib/useShopScreen';
import { ShopItemPreview } from '../ShopItemPreview';

type Props = {
  visible: boolean;
  item: ShopItem | null;
  coins: number;
  characterId: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: (equipAfter: boolean) => void;
};

export function PurchaseDialog({ visible, item, coins, characterId, loading, onClose, onConfirm }: Props) {
  const [equipAfter, setEquipAfter] = useState(true);
  useEffect(() => {
    if (visible) setEquipAfter(true);
  }, [visible]);

  const price = item?.price ?? 0;
  const categoryLabel = SHOP_TABS.find(tab => tab.category === item?.category)?.label ?? '';

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      dismissible={!loading}
      title="구매할까요?"
      buttons={[
        { label: '취소', color: 'light', onPress: onClose, disabled: loading },
        { label: '구매', color: 'primary', onPress: () => onConfirm(equipAfter), loading },
      ]}
    >
      {item && (
        <View sx={{ alignItems: 'center', gap: spacing.MD }}>
          <ShopItemPreview item={item} characterId={characterId} size={104} />
          <View sx={{ alignItems: 'center' }}>
            <Text sx={{ fontSize: 12, lineHeight: 18, color: colors.LIGHT_500 }}>{categoryLabel}</Text>
            <Text variants={['bold', 'T2']} sx={{ color: colors.LIGHT_100 }}>
              {item.name}
            </Text>
          </View>
          <View sx={sxStyles.receipt}>
            <View sx={sxStyles.row}>
              <Text sx={sxStyles.label}>보유</Text>
              <Text sx={{ color: colors.LIGHT_100 }}>{coins}</Text>
            </View>
            <View sx={sxStyles.row}>
              <Text sx={sxStyles.label}>가격</Text>
              <Text sx={{ color: colors.PRIMARY_200 }}>- {price}</Text>
            </View>
            <View style={styles.divider} />
            <View sx={sxStyles.row}>
              <Text sx={sxStyles.label}>구매 후</Text>
              <Text variants={['bold', 'T3']} sx={{ color: colors.WARNING_400 }}>
                {coins - price}
              </Text>
            </View>
          </View>
          <FeedbackPressable
            onPress={() => setEquipAfter(prev => !prev)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: equipAfter }}
            style={styles.checkRow}
          >
            <View style={styles.checkBox}>
              <PixelFrame borderColor={colors.SECONDARY_200} borderWidth={2} notchSize={3} style={StyleSheet.absoluteFill}>
                <View
                  style={[StyleSheet.absoluteFill, { backgroundColor: equipAfter ? colors.SECONDARY_300 : colors.DARK_300 }]}
                />
              </PixelFrame>
            </View>
            <Text sx={{ fontSize: 14, color: colors.LIGHT_300 }}>구매 후 바로 장착</Text>
          </FeedbackPressable>
        </View>
      )}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  divider: { height: 2, backgroundColor: colors.DARK_100 },
  checkRow: { alignSelf: 'stretch', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkBox: { width: 20, height: 20 },
});

const sxStyles = {
  receipt: { alignSelf: 'stretch' as const, gap: 6, padding: spacing.MD, backgroundColor: colors.DARK_400 },
  row: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  label: { color: colors.LIGHT_500 },
};
