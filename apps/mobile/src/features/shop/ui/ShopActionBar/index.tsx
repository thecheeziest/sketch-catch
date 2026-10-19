import { Text, View } from 'dripsy';
import { colors, spacing } from '@/shared/config';
import { Button } from '@/shared/ui/Button';
import { SHOP_TABS, type ShopTile } from '../../lib/useShopScreen';
import type { ShopCategory } from '@sketch-catch/shared';

type Props = {
  category: ShopCategory;
  current: ShopTile | null;
  coins: number;
  isEquipping: boolean;
  onEquip: () => void;
  onPurchase: () => void;
};

const ACTION_WIDTH = 168;

// 고른 아이템 이름 + 상태별 버튼 (장착중 / 장착하기 / 구매 / 코인 부족)
export function ShopActionBar({ category, current, coins, isEquipping, onEquip, onPurchase }: Props) {
  const categoryLabel = SHOP_TABS.find(tab => tab.category === category)?.label ?? '';

  const action = (() => {
    if (!current) return null;
    switch (current.state) {
      case 'EQUIPPED':
        return <Button label="장착중" color="dark" disabled style={{ width: ACTION_WIDTH }} />;
      case 'OWNED':
        return (
          <Button label="장착하기" color="secondary" loading={isEquipping} onPress={onEquip} style={{ width: ACTION_WIDTH }} />
        );
      case 'BUYABLE':
        return <Button label={`구매 · ${current.item?.price}`} color="primary" onPress={onPurchase} style={{ width: ACTION_WIDTH }} />;
      case 'SHORT':
        return (
          <Button
            label={`${(current.item?.price ?? 0) - coins} 코인 부족`}
            color="dark"
            onPress={onPurchase}
            style={{ width: ACTION_WIDTH }}
          />
        );
    }
  })();

  return (
    <View sx={sxStyles.bar}>
      <View sx={{ flex: 1 }}>
        <Text sx={{ fontSize: 12, lineHeight: 18, color: colors.LIGHT_500 }}>{categoryLabel}</Text>
        <Text variants={['bold', 'T3']} sx={{ color: colors.LIGHT_100 }} numberOfLines={1}>
          {current?.name ?? ''}
        </Text>
      </View>
      {action}
    </View>
  );
}

const sxStyles = {
  bar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.MD,
    paddingHorizontal: spacing.MD,
    paddingTop: spacing.MD,
    backgroundColor: colors.DARK_400,
  },
};
