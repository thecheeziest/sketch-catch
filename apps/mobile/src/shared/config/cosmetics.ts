import {
  getShopItem,
  type BackgroundItem,
  type ChatColorItem,
  type FrameDeco,
  type FrameItem,
  type PixelSpriteData,
} from '@sketch-catch/shared';

// 장착 id → 카탈로그 항목. 없거나 카테고리가 다르면 기본 모습(null)
export function getFrameItem(id: string | null | undefined): FrameItem | null {
  const item = id ? getShopItem(id) : undefined;
  return item?.category === 'FRAME' ? item : null;
}

export function getBackgroundItem(id: string | null | undefined): BackgroundItem | null {
  const item = id ? getShopItem(id) : undefined;
  return item?.category === 'BACKGROUND' ? item : null;
}

export function getChatTextColor(id: string | null | undefined): string | null {
  const item = id ? getShopItem(id) : undefined;
  return item?.category === 'CHAT_COLOR' ? (item as ChatColorItem).color : null;
}

const INK = '#2B1E3A';

export const COIN_SPRITE: PixelSpriteData = {
  rows: ['..oooo..', '.oyyyyo.', 'oyhyyyyo', 'oyhyyyyo', 'oyhyyyyo', 'oyyyyyyo', '.oyyyyo.', '..oooo..'],
  colors: { o: '#CC8800', y: '#FFCC00', h: '#FFEE66' },
};

// 특수 프레임 장식 — 고양이 귀는 프레임 색을 따라가므로 색을 받아 만든다
export function getFrameDecoSprite(deco: FrameDeco, color: string): PixelSpriteData {
  switch (deco) {
    case 'CAT_EAR':
      return { rows: ['...o...', '..ooo..', '.ocpco.', 'occpcco'], colors: { o: INK, c: color, p: '#FFD0E8' } };
    case 'CROWN':
      return {
        rows: ['o..o..o', 'oy.y.yo', 'oyyyyyo', 'oyryryo', 'ooooooo'],
        colors: { o: INK, y: '#FFCC00', r: '#FF0077' },
      };
    case 'RIBBON':
      return { rows: ['oo...oo', 'opo.opo', 'oppdppo', 'opo.opo', 'oo...oo'], colors: { o: INK, p: color, d: '#BB0055' } };
    case 'SPROUT':
      return { rows: ['ll...ll', 'lgl.lgl', '.lgsgl.', '...s...', '...s...'], colors: { l: '#72E0A2', g: '#04C165', s: '#046335' } };
  }
}
