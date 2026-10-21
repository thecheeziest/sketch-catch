import { CHARACTER_GROUPS, SHOP_RARITIES, type ShopRarity } from '@sketch-catch/shared';
import type { ShopTile } from './useShopScreen';

export type ShopCatalogRow =
  | { key: string; kind: 'heading'; rarity: ShopRarity; count: number }
  | { key: string; kind: 'character-heading'; name: string; count: number }
  | { key: string; kind: 'items'; tiles: ShopTile[] };

// 기본 모습(item null)은 일반 등급 카드로 다룬다 — 다른 걸 사도 늘 보유 상태로 남는다
const rarityOf = (tile: ShopTile): ShopRarity => tile.item?.rarity ?? 'COMMON';

// 등급이 바뀔 때 새 행을 시작한다. 캐릭터는 등급이 없으므로 등급 헤딩 대신 과일·동물·채소 분류만 둔다.
export function getShopCatalogRows(tiles: ShopTile[]): ShopCatalogRow[] {
  const rows: ShopCatalogRow[] = [];
  const isCharacter = tiles.some(tile => tile.item?.category === 'CHARACTER');
  for (const rarity of SHOP_RARITIES) {
    const items = tiles.filter(tile => rarityOf(tile) === rarity);
    if (items.length === 0) continue;
    if (!isCharacter) rows.push({ key: rarity, kind: 'heading', rarity, count: items.length });
    const sections =
      isCharacter
        ? CHARACTER_GROUPS.map(group => {
            const ids = new Set<string>(group.ids);
            return { key: group.id, name: group.name, items: items.filter(tile => ids.has(tile.item?.id ?? '')) };
          })
        : [{ key: rarity, name: null, items }];
    for (const section of sections) {
      if (section.items.length === 0) continue;
      if (section.name)
        rows.push({
          key: `${rarity}-${section.key}`,
          kind: 'character-heading',
          name: section.name,
          count: section.items.length,
        });
      for (let offset = 0; offset < section.items.length; offset += 3) {
        rows.push({
          key: `${rarity}-${section.key}-${offset}`,
          kind: 'items',
          tiles: section.items.slice(offset, offset + 3),
        });
      }
    }
  }
  return rows;
}
