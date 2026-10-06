import { describe, expect, it } from 'vitest';
import { createHandwriting } from './handwriting';

describe('로딩 필기 경로', () => {
  it('연필 이동 거리와 그려지는 획 길이가 일치하며 획 사이 이동은 포함하지 않는다', () => {
    const writing = createHandwriting();
    let distance = 0;
    for (const segment of writing.segments) {
      expect(segment.start).toBe(distance);
      expect(segment.from.x === segment.to.x || segment.from.y === segment.to.y).toBe(true);
      distance += Math.abs(segment.to.x - segment.from.x) + Math.abs(segment.to.y - segment.from.y);
      expect(segment.end).toBe(distance);
    }
    expect(distance).toBe(writing.length);
    expect(writing.contours).toHaveLength(11);
    expect(writing.segments.at(-1)?.to).toEqual({ x: 244, y: 148 });
  });

  it('필기 좌표가 스케치북 종이 안의 2px 격자에 위치한다', () => {
    const writing = createHandwriting();
    for (const point of writing.contours.flat()) {
      expect(point.x % 2).toBe(0);
      expect(point.y % 2).toBe(0);
      expect(point.x).toBeGreaterThanOrEqual(28);
      expect(point.x).toBeLessThanOrEqual(292);
      expect(point.y).toBeGreaterThanOrEqual(62);
      expect(point.y).toBeLessThanOrEqual(190);
    }
  });
});
