import { describe, expect, it } from 'vitest';
import {
  COSMETIC_ARTWORKS,
  getShopItem,
  getShopItemsByCategory,
  SHOP_ITEMS,
  SHOP_RARITIES,
} from '@sketch-catch/shared';
import { getShopCatalogRows } from './catalog';
import type { ShopTile } from './useShopScreen';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map(offset => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    if (value <= 0.04045) return value / 12.92;
    return ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

describe('캐치샵 상품 구성', () => {
  it('아이템 ID가 중복되지 않고 전설 가격이 기존 상품보다 높다', () => {
    expect(new Set(SHOP_ITEMS.map(item => item.id)).size).toBe(SHOP_ITEMS.length);
    const legendary = SHOP_ITEMS.filter(item => item.rarity === 'LEGENDARY');
    expect(legendary).toHaveLength(36);
    expect(legendary.every(item => item.price === 2000)).toBe(true);
    expect(SHOP_ITEMS.filter(item => item.rarity !== 'LEGENDARY').every(item => item.price < 2000)).toBe(true);
  });

  it.each(['FRAME', 'BACKGROUND', 'CHAT_COLOR'] as const)('%s의 등급별 상품을 3개 단위로 맞춘다', category => {
    const items = getShopItemsByCategory(category);
    expect(items.filter(item => item.rarity === 'LEGENDARY')).toHaveLength(12);
    for (const rarity of SHOP_RARITIES) {
      expect(items.filter(item => item.rarity === rarity).length % 3).toBe(0);
    }
    const tiles: ShopTile[] = items.map(item => ({
      key: item.id,
      item,
      name: item.name,
      state: 'BUYABLE',
      selected: false,
    }));
    const defaultTile: ShopTile = { key: 'default', item: null, name: '기본', state: 'EQUIPPED', selected: true };
    const rows = getShopCatalogRows([defaultTile, ...tiles]);
    expect(rows[0]?.kind).toBe('default');
    for (const row of rows) {
      if (row.kind !== 'items') continue;
      expect(row.tiles).toHaveLength(3);
      expect(new Set(row.tiles.map(tile => tile.item?.rarity)).size).toBe(1);
    }
  });

  it('모든 전설 테두리·배경에 각각 고유한 아트워크가 연결된다', () => {
    for (const category of ['FRAME', 'BACKGROUND'] as const) {
      const artworks = getShopItemsByCategory(category)
        .filter(item => item.rarity === 'LEGENDARY')
        .map(item => item.artwork);
      expect(artworks).toEqual([...COSMETIC_ARTWORKS]);
    }
  });

  it('일반 테두리의 보라를 검정으로 바꾸되 기존 보유 ID를 유지한다', () => {
    expect(getShopItem('frame_lavender')).toMatchObject({ name: '검정 테두리', color: '#111118' });
    const frames = getShopItemsByCategory('FRAME').filter(item => item.rarity === 'COMMON');
    expect(frames).toHaveLength(9);
    expect(new Set(frames.map(item => item.color)).size).toBe(9);
    expect(frames.some(item => item.color === '#BB77FF' || item.color === '#8833FF')).toBe(false);
  });

  it('채팅색 중복이 없고 모든 본문 색 띠가 실제 말풍선 위 4.5:1 이상이다', () => {
    const items = getShopItemsByCategory('CHAT_COLOR');
    expect(new Set(items.map(item => item.color)).size).toBe(items.length);
    for (const item of items) {
      for (const color of item.bands ?? [item.color]) {
        for (const background of ['#2F2440', '#141220', '#1E1C2C']) {
          const ratio = (luminance(color) + 0.05) / (luminance(background) + 0.05);
          expect(ratio, `${item.id} ${color} on ${background}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
  it('전설 12종은 단색만으로 렌더되지 않고 서로 다른 외곽선·그림자를 가진다', () => {
    const items = getShopItemsByCategory('CHAT_COLOR').filter(item => item.rarity === 'LEGENDARY');
    const effects = items.map(item =>
      JSON.stringify({ outlines: item.outlines, shadows: item.shadows, hollow: item.hollow }),
    );
    expect(new Set(effects).size).toBe(12);
    for (const item of items) {
      expect(item.hollow || (item.outlines?.length ?? 0) + (item.shadows?.length ?? 0) > 0).toBe(true);
      for (const outline of item.outlines ?? []) expect(outline.width).toBeGreaterThanOrEqual(1);
      for (const shadow of item.shadows ?? []) {
        expect(Math.max(Math.abs(shadow.x), Math.abs(shadow.y), shadow.blur ?? 0)).toBeGreaterThanOrEqual(1);
      }
    }
  });
  it('레인보우는 채움과 그림자 없이 기존 무지개 색을 외곽선에 사용한다', () => {
    expect(getShopItem('chat_legend_rainbow')).toMatchObject({
      hollow: true,
      bands: ['#F3B4CD', '#F4CF9F', '#F4E9AB', '#ACDCCA', '#A9D8EE', '#CAB6E6'],
    });
    expect(getShopItem('chat_legend_rainbow')).not.toHaveProperty('shadows');
    expect(getShopItem('chat_legend_rainbow')).not.toHaveProperty('outlines');
  });
});
