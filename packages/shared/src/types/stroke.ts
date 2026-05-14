// DEVELOPER.md §8.1 — Stroke 자료구조
// x, y는 0~1 정규화 좌표, t는 ms 단위 타임스탬프
export type Point = {
  x: number;
  y: number;
  t: number;
};

export type Stroke = {
  id: string;
  authorId: string;
  color: string;
  width: number; // 정규화 width = width / canvasWidth (0~1)
  points: Point[];
  startTime: number; // 라운드 시작 기준 ms
};

export type StrokeEvent = {
  strokeId: string;
  authorId: string;
  color?: string;
  width?: number;
  points?: Point[];
  ended?: boolean;
};
