export type Point = { x: number; y: number };

// 한 획씩 쓰는 순서. 2px 격자로 계단을 만들어 레트로 필기 질감을 유지한다.
const strokes: [[number, number], ...[number, number][]][] = [
  [
    [70, 100],
    [60, 120],
    [54, 140],
    [56, 146],
    [66, 148],
    [80, 144],
  ], // L
  [
    [96, 134],
    [90, 130],
    [84, 134],
    [82, 142],
    [86, 148],
    [94, 146],
    [98, 136],
    [96, 134],
  ], // o
  [
    [116, 134],
    [110, 130],
    [104, 134],
    [102, 142],
    [106, 148],
    [114, 144],
    [118, 132],
    [114, 146],
    [122, 144],
  ], // a
  [
    [138, 132],
    [132, 130],
    [126, 134],
    [124, 142],
    [128, 148],
    [136, 144],
    [144, 106],
    [148, 100],
    [144, 120],
    [136, 146],
    [146, 144],
  ], // d
  [
    [156, 132],
    [152, 146],
    [160, 144],
  ], // i
  [
    [158, 122],
    [158, 124],
  ],
  [
    [166, 134],
    [164, 148],
    [170, 134],
    [178, 132],
    [180, 136],
    [176, 146],
    [184, 144],
  ], // n
  [
    [204, 134],
    [198, 130],
    [190, 134],
    [188, 142],
    [192, 148],
    [200, 144],
    [204, 132],
    [198, 158],
    [190, 170],
    [182, 168],
    [186, 160],
    [204, 150],
    [210, 144],
  ], // g
  [
    [220, 146],
    [220, 148],
  ],
  [
    [232, 146],
    [232, 148],
  ],
  [
    [244, 146],
    [244, 148],
  ],
];

export function createHandwriting() {
  const contours: [Point, ...Point[]][] = [];
  const segments: { from: Point; to: Point; start: number; end: number }[] = [];
  let length = 0;
  for (const stroke of strokes) {
    let current: Point = { x: stroke[0][0], y: stroke[0][1] };
    const points: [Point, ...Point[]] = [current];
    for (const [x, y] of stroke.slice(1)) {
      const from = current;
      const steps = Math.max(Math.abs(x - from.x), Math.abs(y - from.y)) / 2;
      for (let step = 1; step <= steps; step += 1) {
        const point = {
          x: Math.round((from.x + ((x - from.x) * step) / steps) / 2) * 2,
          y: Math.round((from.y + ((y - from.y) * step) / steps) / 2) * 2,
        };
        // 두 축이 바뀌면 수평·수직 두 획으로 나눠 대각선 안티앨리어싱을 피한다.
        const corners = [{ x: point.x, y: current.y }, point];
        for (const corner of corners) {
          const last = current;
          const distance = Math.abs(corner.x - last.x) + Math.abs(corner.y - last.y);
          if (distance === 0) continue;
          segments.push({ from: last, to: corner, start: length, end: length + distance });
          length += distance;
          points.push(corner);
          current = corner;
        }
      }
    }
    contours.push(points);
  }
  return { contours, segments, length };
}
