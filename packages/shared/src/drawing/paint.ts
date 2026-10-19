import { z } from 'zod';

// 캔버스 크기와 무관하게 동일 영역을 재생하기 위한 정규화된 가로 띠.
export type PaintSpan = { x: number; y: number; width: number; height: number };
export const MAX_PAINT_SPANS = 4096;
export const paintSpansSchema = z
  .array(
    z
      .object({
        x: z.number().finite().min(0).max(1),
        y: z.number().finite().min(0).max(1),
        width: z.number().finite().positive().max(1),
        height: z.number().finite().positive().max(1),
      })
      .refine(span => span.x + span.width <= 1.000001 && span.y + span.height <= 1.000001),
  )
  .min(1)
  .max(MAX_PAINT_SPANS);

// 4방향 연결 영역만 방문하므로 닫힌 선의 바깥으로 번지지 않는다.
export function findPaintSpans(pixels: Uint8Array, width: number, height: number, x: number, y: number): PaintSpan[] {
  if (pixels.length !== width * height * 4 || x < 0 || y < 0 || x >= width || y >= height) return [];
  const seed = (Math.floor(y) * width + Math.floor(x)) * 4;
  const target = pixels.slice(seed, seed + 4);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 1;
  queue[0] = seed / 4;
  visited[queue[0]!] = 1;
  const matches = (index: number): boolean => {
    for (let channel = 0; channel < 4; channel++) {
      if (Math.abs(pixels[index * 4 + channel]! - target[channel]!) > 24) return false;
    }
    return true;
  };
  while (head < tail) {
    const index = queue[head++]!;
    const px = index % width;
    const neighbors = [index - width, index + width];
    if (px > 0) neighbors.push(index - 1);
    if (px < width - 1) neighbors.push(index + 1);
    for (const next of neighbors) {
      if (next < 0 || next >= visited.length || visited[next] || !matches(next)) continue;
      visited[next] = 1;
      queue[tail++] = next;
    }
  }
  const spans: PaintSpan[] = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (!visited[row * width + col]) continue;
      const start = col;
      while (col + 1 < width && visited[row * width + col + 1]) col++;
      spans.push({ x: start / width, y: row / height, width: (col - start + 1) / width, height: 1 / height });
    }
  }
  return spans;
}
