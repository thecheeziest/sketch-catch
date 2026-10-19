import { describe, expect, it } from 'vitest';
import { findPaintSpans, paintSpansSchema } from '@sketch-catch/shared';

function image(w: number, h: number, black: (x: number, y: number) => boolean): Uint8Array {
  return Uint8Array.from({ length: w * h * 4 }, (_, index) => {
    if (index % 4 === 3) return 255;
    const pixel = Math.floor(index / 4);
    return black(pixel % w, Math.floor(pixel / w)) ? 0 : 255;
  });
}
const area = (spans: ReturnType<typeof findPaintSpans>) =>
  spans.reduce((sum, span) => sum + span.width * span.height, 0);

describe('영역 페인트', () => {
  it('빈 종이는 전체를 채운다', () => {
    const spans = findPaintSpans(
      image(8, 8, () => false),
      8,
      8,
      4,
      4,
    );
    expect(area(spans)).toBe(1);
    expect(paintSpansSchema.safeParse(spans).success).toBe(true);
  });
  it('닫힌 테두리 내부만 채우고 바깥과 선은 보존한다', () => {
    const spans = findPaintSpans(
      image(8, 8, (x, y) => (x >= 1 && x <= 6 && (y === 1 || y === 6)) || (y >= 1 && y <= 6 && (x === 1 || x === 6))),
      8,
      8,
      3,
      3,
    );
    expect(area(spans)).toBe(16 / 64);
    expect(spans.every(s => s.x >= 2 / 8 && s.x + s.width <= 6 / 8 && s.y >= 2 / 8 && s.y < 6 / 8)).toBe(true);
  });
  it('열린 테두리는 틈으로 연결된 바깥 영역까지 채운다', () => {
    const pixels = image(
      8,
      8,
      (x, y) => (x >= 1 && x <= 6 && (y === 1 || y === 6)) || (y >= 1 && y <= 6 && (x === 1 || x === 6)),
    );
    pixels.fill(255, (1 * 8 + 3) * 4, (1 * 8 + 3) * 4 + 4);
    expect(area(findPaintSpans(pixels, 8, 8, 3, 3))).toBeGreaterThan(16 / 64);
  });
  it('잘못된 좌표와 캔버스 밖 영역을 거부한다', () => {
    expect(
      findPaintSpans(
        image(8, 8, () => false),
        8,
        8,
        -1,
        1,
      ),
    ).toEqual([]);
    expect(paintSpansSchema.safeParse([{ x: 0.9, y: 0, width: 0.2, height: 0.1 }]).success).toBe(false);
  });
});
