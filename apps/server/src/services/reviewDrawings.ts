import type { Stroke } from '@sketch-catch/shared';

export const REVIEW_WORDS = ['고양이', '토끼', '오리'] as const;

// 봇이 실제 stroke 입력으로 그리는 체험용 동물 그림
export function makeReviewDrawing(authorId: string, text: string): Stroke[] {
  const strokes: Stroke[] = [];
  const line = (points: number[][], color = '#493451'): void => {
    strokes.push({
      id: `bot-${strokes.length}`,
      authorId,
      color,
      width: 0.012,
      startTime: strokes.length * 450,
      points: points.map(([x = 0, y = 0], i) => ({ x, y, t: i * 20 })),
    });
  };
  const oval = (x: number, y: number, rx: number, ry: number, color?: string): void => {
    line(
      Array.from({ length: 49 }, (_, i) => [
        x + rx * Math.cos((i * Math.PI) / 24),
        y + ry * Math.sin((i * Math.PI) / 24),
      ]),
      color,
    );
  };

  if (text.includes('오리')) {
    oval(0.5, 0.62, 0.24, 0.16, '#D9A600');
    oval(0.57, 0.38, 0.13, 0.14, '#D9A600');
    line(
      [
        [0.68, 0.37],
        [0.84, 0.43],
        [0.68, 0.47],
      ],
      '#E87528',
    );
    oval(0.6, 0.35, 0.012, 0.018);
    line(
      [
        [0.42, 0.61],
        [0.5, 0.67],
        [0.59, 0.6],
      ],
      '#D9A600',
    );
    line(
      [
        [0.24, 0.58],
        [0.14, 0.5],
        [0.27, 0.68],
      ],
      '#D9A600',
    );
    return strokes;
  }

  if (text.includes('토끼')) {
    oval(0.39, 0.27, 0.055, 0.17);
    oval(0.61, 0.27, 0.055, 0.17);
    oval(0.5, 0.57, 0.23, 0.22);
  } else {
    line([
      [0.28, 0.5],
      [0.28, 0.25],
      [0.42, 0.36],
      [0.58, 0.36],
      [0.72, 0.25],
      [0.72, 0.5],
    ]);
    line([
      [0.28, 0.5],
      [0.3, 0.65],
      [0.4, 0.75],
      [0.6, 0.75],
      [0.7, 0.65],
      [0.72, 0.5],
    ]);
    line([
      [0.15, 0.55],
      [0.37, 0.59],
    ]);
    line([
      [0.15, 0.65],
      [0.37, 0.63],
    ]);
    line([
      [0.63, 0.59],
      [0.85, 0.55],
    ]);
    line([
      [0.63, 0.63],
      [0.85, 0.65],
    ]);
  }
  oval(0.4, 0.53, 0.015, 0.025);
  oval(0.6, 0.53, 0.015, 0.025);
  line(
    [
      [0.46, 0.6],
      [0.5, 0.64],
      [0.54, 0.6],
    ],
    '#EF6C9B',
  );
  line([
    [0.5, 0.64],
    [0.5, 0.69],
    [0.45, 0.71],
  ]);
  line([
    [0.5, 0.69],
    [0.55, 0.71],
  ]);
  return strokes;
}
