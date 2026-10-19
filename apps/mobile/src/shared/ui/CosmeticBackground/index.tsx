import { useMemo, type ReactElement } from 'react';
import { Canvas, Circle, Line, Rect, vec } from '@shopify/react-native-skia';
import type { BackgroundPattern } from '@sketch-catch/shared';

type Props = {
  pattern: BackgroundPattern;
  size: number;
};

// 별 위치(0~1 비율) — 매 렌더 같은 자리에 찍히도록 고정값을 쓴다
const STAR_POINTS = [
  [0.12, 0.18], [0.42, 0.08], [0.78, 0.2], [0.3, 0.42], [0.88, 0.48],
  [0.08, 0.7], [0.55, 0.62], [0.72, 0.86], [0.24, 0.9], [0.62, 0.32],
] as const;

function drawStars(size: number, colorA: string, colorB: string): ReactElement[] {
  const dot = Math.max(1, Math.round(size / 28));
  return STAR_POINTS.map(([x, y], i) => (
    <Rect
      key={`s${i}`}
      x={Math.round(x * size)}
      y={Math.round(y * size)}
      width={dot}
      height={dot}
      color={i % 3 === 0 ? colorB : colorA}
    />
  ));
}

function drawPattern(pattern: BackgroundPattern, size: number): ReactElement[] {
  switch (pattern) {
    case 'CHECK': {
      const cell = size / 6;
      const cells: ReactElement[] = [<Rect key="bg" x={0} y={0} width={size} height={size} color="#2D2B3D" />];
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          if ((r + c) % 2 === 0) {
            cells.push(<Rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} color="#3B2A6E" />);
          }
        }
      }
      return cells;
    }
    case 'DOTS': {
      const gap = size / 5;
      const dots: ReactElement[] = [<Rect key="bg" x={0} y={0} width={size} height={size} color="#2D2B3D" />];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          dots.push(<Circle key={`${r}-${c}`} cx={gap * (c + 0.5)} cy={gap * (r + 0.5)} r={gap * 0.16} color="#FF88BB" />);
        }
      }
      return dots;
    }
    case 'STRIPE': {
      const step = size / 4;
      const lines: ReactElement[] = [<Rect key="bg" x={0} y={0} width={size} height={size} color="#2D2B3D" />];
      for (let i = -4; i <= 4; i++) {
        lines.push(
          <Line
            key={i}
            p1={vec(i * step, 0)}
            p2={vec(i * step + size, size)}
            color="#1E3A5C"
            strokeWidth={step / 2}
          />,
        );
      }
      return lines;
    }
    case 'STARS':
      return [
        <Rect key="bg" x={0} y={0} width={size} height={size} color="#2A1F5C" />,
        ...drawStars(size, '#FFEE66', '#BB77FF'),
      ];
    case 'SUNSET':
      return [
        <Rect key="a" x={0} y={0} width={size} height={size / 3} color="#FF9F5A" />,
        <Rect key="b" x={0} y={size / 3} width={size} height={size / 3} color="#FF3388" />,
        <Rect key="c" x={0} y={(size * 2) / 3} width={size} height={size / 3 + 1} color="#6600EE" />,
      ];
    case 'SPACE':
      return [
        <Rect key="bg" x={0} y={0} width={size} height={size} color="#0C0A16" />,
        ...drawStars(size, '#FAFAFA', '#77AAFF'),
        <Circle key="planet" cx={size * 0.78} cy={size * 0.78} r={size * 0.14} color="#8833FF" />,
      ];
  }
}

// 캐릭터 뒤 배경 패턴 — 상점 미리보기·대기실·게임 칸에서 같은 모양으로 그린다
export function CosmeticBackground({ pattern, size }: Props) {
  const shapes = useMemo(() => drawPattern(pattern, size), [pattern, size]);
  return <Canvas style={{ width: size, height: size }}>{shapes}</Canvas>;
}
