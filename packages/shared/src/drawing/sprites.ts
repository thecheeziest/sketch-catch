// 정답 공개식 픽셀 소품 — 앱(Skia)과 서버 GIF(@napi-rs/canvas)가 같은 도트를 그리도록 공유한다.
// rows의 각 글자가 1픽셀이며 '.'은 투명, 나머지는 colors에서 색을 찾는다.
export type PixelSpriteData = {
  rows: readonly string[];
  colors: Readonly<Record<string, string>>;
};

const INK = '#2B1E3A';

export const PALETTE_SPRITE: PixelSpriteData = {
  rows: [
    '...oooooo...',
    '..owwwwwwo..',
    '.owrrwwbbwo.',
    'owwrrwwbbwwo',
    'owwwwww..wwo',
    'owyywww..wwo',
    'owyywwwwwwwo',
    '.owwwggwwwo.',
    '..owwggwwo..',
    '...oooooo...',
  ],
  colors: { o: INK, w: '#E8C58A', r: '#FF5C7A', b: '#5876C4', y: '#FFD24F', g: '#4FB86A' },
};

export const BRUSH_SPRITE: PixelSpriteData = {
  rows: [
    '..pp..',
    '.pppp.',
    '.pppp.',
    '..pp..',
    '.ssss.',
    '.ssss.',
    '..hh..',
    '..hh..',
    '..hh..',
    '..hh..',
    '..hh..',
    '..hh..',
    '..oo..',
  ],
  colors: { o: INK, p: '#FF7BA3', s: '#B8B8C8', h: '#A67F5C' },
};

export const QUESTION_SPRITE: PixelSpriteData = {
  rows: ['.ooooo.', 'oo...oo', 'oo...oo', '....oo.', '...oo..', '...oo..', '.......', '...oo..', '...oo..'],
  colors: { o: '#B18AF0' },
};

export const BULB_SPRITE: PixelSpriteData = {
  rows: [
    '..ooooo..',
    '.oyyyyyo.',
    'oyylyyyyo',
    'oylyyyyyo',
    'oyyyyyyyo',
    'oyyyyyyyo',
    '.oyyyyyo.',
    '..oyyyo..',
    '..ossso..',
    '..ossso..',
    '...ooo...',
  ],
  colors: { o: INK, y: '#FFE066', l: '#FFFDF0', s: '#B8B8C8' },
};

export type SpritePixel = { x: number; y: number; color: string };

// 투명이 아닌 픽셀 목록 — 렌더러는 이 목록을 pixelSize 배율로 사각형만 찍으면 된다
export function getSpritePixels(sprite: PixelSpriteData): SpritePixel[] {
  const pixels: SpritePixel[] = [];
  sprite.rows.forEach((row, y) => {
    [...row].forEach((key, x) => {
      const color = sprite.colors[key];
      if (color) pixels.push({ x, y, color });
    });
  });
  return pixels;
}

export function getSpriteSize(sprite: PixelSpriteData): { width: number; height: number } {
  return { width: Math.max(...sprite.rows.map(row => row.length)), height: sprite.rows.length };
}
