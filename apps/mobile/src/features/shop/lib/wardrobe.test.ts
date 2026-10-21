import { describe, expect, it } from 'vitest';
import { getShopItem, getShopItemsByCategory } from '@sketch-catch/shared';
import { getShopCatalogRows } from './catalog';
import type { ShopTile } from './useShopScreen';
import { equippedFirst, getEquipChanges, isInWardrobe, parseCosmeticsView, type Selection } from './wardrobe';

const EQUIPPED: Selection = { CHARACTER: 'apple', FRAME: null, BACKGROUND: 'bg_dots', CHAT_COLOR: null };

describe('내 옷장', () => {
  it('알 수 없는 view 파라미터는 캐치샵으로 연다', () => {
    expect(parseCosmeticsView('wardrobe')).toBe('wardrobe');
    expect(parseCosmeticsView('shop')).toBe('shop');
    expect(parseCosmeticsView(undefined)).toBe('shop');
    expect(parseCosmeticsView(['wardrobe'])).toBe('shop');
  });

  it('기본 모습·보유·장착 중인 아이템만 보이고 분류별 행 구성은 샵과 같다', () => {
    const owned = ['fox', 'carrot'];
    const characters = getShopItemsByCategory('CHARACTER').filter(item => isInWardrobe(item, owned, 'apple'));
    expect(characters.map(item => item.id)).toEqual(['apple', 'fox', 'carrot']);
    expect(isInWardrobe(null, owned, null)).toBe(true);
    expect(isInWardrobe(getShopItem('frame_mint')!, owned, null)).toBe(false);

    const tiles: ShopTile[] = characters.map(item => ({
      key: item.id,
      item,
      name: item.name,
      state: item.id === 'apple' ? 'EQUIPPED' : 'OWNED',
      selected: false,
    }));
    const rows = getShopCatalogRows(tiles);
    expect(rows[0]).toMatchObject({ kind: 'character-heading', name: '과일', count: 1 });
    expect(rows.filter(row => row.kind === 'character-heading').map(row => row.name)).toEqual(['과일', '동물', '채소']);
  });

  it('장착과 다른 카테고리만 저장 요청에 담는다', () => {
    expect(getEquipChanges(EQUIPPED, {})).toBeNull();
    expect(getEquipChanges(EQUIPPED, { CHARACTER: 'apple', BACKGROUND: 'bg_dots' })).toBeNull();
    expect(getEquipChanges(EQUIPPED, { CHARACTER: 'fox', FRAME: null, BACKGROUND: null })).toEqual({
      CHARACTER: 'fox',
      BACKGROUND: null,
    });
  });

  it('기본 테두리는 다른 걸 사도 옷장의 일반 등급 첫 카드로 남는다', () => {
    const frames = [null, ...getShopItemsByCategory('FRAME')].filter(item => isInWardrobe(item, ['frame_mint'], 'frame_mint'));
    const tiles: ShopTile[] = frames.map(item => ({
      key: item?.id ?? 'default-FRAME',
      item,
      name: item?.name ?? '기본 테두리',
      state: item ? 'EQUIPPED' : 'OWNED',
      selected: false,
    }));
    const rows = getShopCatalogRows(tiles);
    expect(rows[0]).toMatchObject({ kind: 'heading', rarity: 'COMMON', count: 2 });
    expect(rows[1]).toMatchObject({ kind: 'items', tiles: [{ name: '기본 테두리' }, { key: 'frame_mint' }] });
  });

  it('장착템은 등급·분류 순서는 그대로 두고 그 그룹 안에서만 첫 카드가 된다', () => {
    const owned = ['apple', 'fox', 'carrot', 'tomato'];
    const characters = getShopItemsByCategory('CHARACTER').filter(item => isInWardrobe(item, owned, 'tomato'));
    const tiles: ShopTile[] = equippedFirst(
      characters.map(item => ({
        key: item.id,
        item,
        name: item.name,
        state: item.id === 'tomato' ? 'EQUIPPED' : 'OWNED',
        selected: false,
      })),
    );
    const rows = getShopCatalogRows(tiles);
    expect(rows.filter(row => row.kind === 'character-heading').map(row => row.name)).toEqual(['과일', '동물', '채소']);
    const vegetables = rows.filter(row => row.kind === 'items').at(-1);
    expect(vegetables).toMatchObject({ tiles: [{ key: 'tomato' }, { key: 'carrot' }] });
  });
});
