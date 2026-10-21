import { SHOP_RARITIES, type ShopRarity } from '@sketch-catch/shared';
import type { ShopTile } from './useShopScreen';

export type ShopCatalogRow =
  | { key: string; kind: 'default'; tile: ShopTile }
  | { key: string; kind: 'heading'; rarity: ShopRarity; count: number }
  | { key: string; kind: 'items'; tiles: ShopTile[] };

// 등급이 바뀔 때 새 행을 시작한다. 기본 해제는 판매 상품 수에 포함하지 않는다.
export function getShopCatalogRows(tiles: ShopTile[]): ShopCatalogRow[] {
  const rows: ShopCatalogRow[] = [];
  const defaultTile = tiles.find(tile => tile.item === null);
  if (defaultTile) rows.push({ key: 'default', kind: 'default', tile: defaultTile });
  for (const rarity of SHOP_RARITIES) {
    const items = tiles.filter(tile => tile.item?.rarity === rarity);
    if (items.length === 0) continue;
    rows.push({ key: rarity, kind: 'heading', rarity, count: items.length });
    for (let offset = 0; offset < items.length; offset += 3) {
      rows.push({ key: `${rarity}-${offset}`, kind: 'items', tiles: items.slice(offset, offset + 3) });
    }
  }
  return rows;
}
