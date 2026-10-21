import { useMemo, type ReactElement } from 'react';
import { Image } from 'dripsy';
import { Canvas, Line, Rect, vec } from '@shopify/react-native-skia';
import type { BackgroundPattern, CosmeticArtwork } from '@sketch-catch/shared';
import { BACKGROUND_ARTWORKS } from '@/shared/config/cosmeticArtworks';

type Props = {
  pattern?: BackgroundPattern;
  artwork?: CosmeticArtwork;
  size: number;
};

// 별 위치(0~1 비율) — 매 렌더 같은 자리에 찍히도록 고정값을 쓴다
const STAR_POINTS = [
  [0.12, 0.18],
  [0.42, 0.08],
  [0.78, 0.2],
  [0.3, 0.42],
  [0.88, 0.48],
  [0.08, 0.7],
  [0.55, 0.62],
  [0.72, 0.86],
  [0.24, 0.9],
  [0.62, 0.32],
] as const;

function drawStars(size: number, colorA: string, colorB: string): ReactElement[] {
  const dot = Math.max(1, Math.round(size / 28));
  return STAR_POINTS.flatMap(([x, y], i) => {
    const left = Math.round(x * size);
    const top = Math.round(y * size);
    const color = i % 3 === 0 ? colorB : colorA;
    return [
      <Rect key={`h${i}`} x={left - dot} y={top} width={dot * 3} height={dot} color={color} />,
      <Rect key={`v${i}`} x={left} y={top - dot} width={dot} height={dot * 3} color={color} />,
    ];
  });
}

function drawPattern(pattern: BackgroundPattern | undefined, size: number): ReactElement[] {
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
      // 고정 좌표의 불규칙한 색종이. 랜덤 생성 없이 화면마다 같은 무늬를 유지한다.
      const pieces = [
        [0.07, 0.12, 2, 1],
        [0.4, 0.06, 1, 2],
        [0.8, 0.17, 1, 1],
        [0.19, 0.42, 1, 2],
        [0.65, 0.34, 2, 1],
        [0.93, 0.5, 1, 1],
        [0.05, 0.76, 1, 1],
        [0.37, 0.88, 2, 1],
        [0.7, 0.73, 1, 2],
        [0.87, 0.91, 1, 1],
        [0.45, 0.55, 1, 1],
      ] as const;
      const pixel = Math.max(1, Math.round(size / 24));
      return [
        <Rect key="bg" x={0} y={0} width={size} height={size} color="#362739" />,
        ...pieces.map(([x, y, w, h], i) => (
          <Rect
            key={i}
            x={Math.round(x * size)}
            y={Math.round(y * size)}
            width={w * pixel}
            height={h * pixel}
            color={i % 3 === 0 ? '#D9A6CD' : '#B66C94'}
          />
        )),
      ];
    }
    case 'STRIPE': {
      const step = size / 4;
      const lines: ReactElement[] = [<Rect key="bg" x={0} y={0} width={size} height={size} color="#2D2B3D" />];
      for (let i = -4; i <= 4; i++) {
        lines.push(
          <Line key={i} p1={vec(i * step, 0)} p2={vec(i * step + size, size)} color="#1E3A5C" strokeWidth={step / 2} />,
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
    case 'SPACE': {
      const pixel = size / 24;
      const orbit = Array.from({ length: 24 }, (_, i) => {
        const angle = (i * Math.PI) / 12;
        return (
          <Rect
            key={`o${i}`}
            x={Math.round(12 + Math.cos(angle) * 14) * pixel}
            y={Math.round(12 + Math.sin(angle) * 5) * pixel}
            width={pixel}
            height={pixel}
            color="#7B72A8"
          />
        );
      });
      return [
        <Rect key="bg" x={0} y={0} width={size} height={size} color="#171B38" />,
        ...orbit,
        <Rect key="p1" x={14 * pixel} y={4 * pixel} width={7 * pixel} height={9 * pixel} color="#9CA3D8" />,
        <Rect key="p2" x={13 * pixel} y={6 * pixel} width={9 * pixel} height={5 * pixel} color="#9CA3D8" />,
        <Rect key="p3" x={15 * pixel} y={5 * pixel} width={3 * pixel} height={2 * pixel} color="#CED5F2" />,
        <Rect key="p4" x={15 * pixel} y={10 * pixel} width={6 * pixel} height={2 * pixel} color="#727AAE" />,
        <Rect key="ring" x={11 * pixel} y={8 * pixel} width={13 * pixel} height={pixel} color="#D1B9D9" />,
      ];
    }
    default:
      return [];
  }
}

// 캐릭터 뒤 배경 패턴 — 상점 미리보기·대기실·게임 칸에서 같은 모양으로 그린다
export function CosmeticBackground({ pattern, artwork, size }: Props) {
  const shapes = useMemo(() => drawPattern(pattern, size), [pattern, size]);
  if (artwork) {
    return <Image source={BACKGROUND_ARTWORKS[artwork]} style={{ width: size, height: size }} resizeMode="cover" />;
  }
  return <Canvas style={{ width: size, height: size }}>{shapes}</Canvas>;
}
