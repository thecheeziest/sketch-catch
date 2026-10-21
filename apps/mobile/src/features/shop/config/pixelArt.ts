import type { PixelSpriteData } from '@sketch-catch/shared';

// 캐치샵 헤더의 옷장 버튼 — 장식 지붕, 문짝 두 개, 금색 손잡이, 다리
export const WARDROBE_SPRITE: PixelSpriteData = {
  rows: [
    '.hhhhhhhhh.',
    'hhhhhhhhhhh',
    'ooooooooooo',
    'owwwwowwwwo',
    'owddwowddwo',
    'owddwowddwo',
    'owddwowddwo',
    'owwwyoywwwo',
    'owddwowddwo',
    'owddwowddwo',
    'owwwwowwwwo',
    'ooooooooooo',
    'oo.......oo',
  ],
  colors: { o: '#5A3018', h: '#E0A868', w: '#D08A4C', d: '#A0602F', y: '#FFCC00' },
};

// 옷장 버튼 테두리 — 나무 지붕색과 맞춘다
export const WARDROBE_BUTTON_BORDER = '#E0A868';

// 샵 → 옷장 전환 커튼. 주름 한 묶음(8칸)을 반복해 세로 줄무늬로 칠한다
export const CURTAIN_PALETTE = {
  folds: ['#4A0A22', '#6E1030', '#981A40', '#981A40', '#C02A50', '#E04A68', '#C02A50', '#981A40'],
  edge: '#E04A68',
  valance: '#5A0C28',
  valanceShade: '#7A1434',
} as const;
