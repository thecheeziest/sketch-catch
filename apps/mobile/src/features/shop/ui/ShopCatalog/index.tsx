import { useCallback, useMemo } from 'react';
import { Text, View } from 'dripsy';
import { StyleSheet, type ListRenderItem } from 'react-native';
import { SHOP_RARITY_NAMES, type ShopCategory } from '@sketch-catch/shared';
import { colors, spacing } from '@/shared/config';
import { FlatList } from '@/shared/ui/FlatList';
import { FeedbackPressable } from '@/shared/ui/FeedbackPressable';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { getShopCatalogRows, type ShopCatalogRow } from '../../lib/catalog';
import type { ShopTile } from '../../lib/useShopScreen';
import { ShopItemTile } from '../ShopItemTile';

type Props = {
  tiles: ShopTile[];
  category: ShopCategory;
  characterId: string;
  tileWidth: number;
  onSelect: (tile: ShopTile) => void;
};

const RARITY_COLORS = { COMMON: colors.LIGHT_300, RARE: colors.INFO_200, LEGENDARY: colors.WARNING_200 };
const rowKey = (row: ShopCatalogRow): string => row.key;

export function ShopCatalog({ tiles, category, characterId, tileWidth, onSelect }: Props) {
  const rows = useMemo(() => getShopCatalogRows(tiles), [tiles]);
  const renderItem: ListRenderItem<ShopCatalogRow> = useCallback(
    ({ item }) => {
      if (item.kind === 'heading') {
        return (
          <View sx={sxStyles.heading}>
            <Text sx={{ fontSize: 14, color: RARITY_COLORS[item.rarity] }}>{SHOP_RARITY_NAMES[item.rarity]}</Text>
            <Text sx={{ fontSize: 11, color: colors.LIGHT_500 }}>{item.count}개</Text>
            {item.rarity === 'LEGENDARY' && (
              <Text sx={{ fontSize: 11, color: colors.WARNING_200, marginLeft: 'auto' }}>프리미엄 컬렉션</Text>
            )}
          </View>
        );
      }
      if (item.kind === 'character-heading') {
        return (
          <View sx={sxStyles.heading}>
            <Text sx={{ fontSize: 13, color: colors.INFO_100 }}>{item.name}</Text>
            <Text sx={{ fontSize: 11, color: colors.LIGHT_500 }}>{item.count}종</Text>
          </View>
        );
      }
      if (item.kind === 'default') {
        return (
          <FeedbackPressable
            onPress={() => onSelect(item.tile)}
            accessibilityRole="button"
            accessibilityLabel={item.tile.name}
            accessibilityState={{ selected: item.tile.selected }}
            style={styles.reset}
          >
            <PixelFrame
              borderColor={item.tile.selected ? colors.WARNING_200 : colors.DARK_100}
              borderWidth={2}
              style={StyleSheet.absoluteFill}
            >
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_200 }]} />
            </PixelFrame>
            <Text sx={{ fontSize: 12, color: colors.LIGHT_300 }}>{item.tile.name}</Text>
            <Text sx={{ fontSize: 11, color: colors.LIGHT_500 }}>
              {item.tile.state === 'EQUIPPED' ? '장착중' : '무료 · 기본 모습'}
            </Text>
          </FeedbackPressable>
        );
      }
      return (
        <View style={styles.row}>
          {item.tiles.map(tile => (
            <ShopItemTile
              key={tile.key}
              tile={tile}
              category={category}
              characterId={characterId}
              width={tileWidth}
              onPress={() => onSelect(tile)}
            />
          ))}
        </View>
      );
    },
    [category, characterId, onSelect, tileWidth],
  );

  return (
    <FlatList<ShopCatalogRow>
      key={category}
      data={rows}
      renderItem={renderItem}
      keyExtractor={rowKey}
      contentContainerStyle={styles.content}
      style={styles.list}
      initialNumToRender={5}
      windowSize={5}
      maxToRenderPerBatch={5}
      extraData={tileWidth}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { gap: 14, paddingHorizontal: spacing.MD, paddingTop: spacing.SM, paddingBottom: spacing.LG },
  row: { flexDirection: 'row', gap: 14 },
  reset: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
});
const sxStyles = {
  heading: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.SM, paddingTop: spacing.SM },
};
