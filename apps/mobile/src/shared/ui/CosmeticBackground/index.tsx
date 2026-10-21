import { useMemo, type ReactElement } from 'react';
import { Image } from 'dripsy';
import { Canvas, Line, Path, Rect, Skia, vec } from '@shopify/react-native-skia';
import type { BackgroundPattern, CosmeticArtwork } from '@sketch-catch/shared';
import { BACKGROUND_ARTWORKS } from '@/shared/config/cosmeticArtworks';

type Props = {
  pattern?: BackgroundPattern;
  color?: string;
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

function drawPattern(pattern: BackgroundPattern | undefined, size: number, color?: string): ReactElement[] {
  switch (pattern) {
    case 'SOLID':
      return [<Rect key="solid" x={0} y={0} width={size} height={size} color={color ?? '#111118'} />];
    case 'CHECK': {
      const cell = size / 6;
      const cells: ReactElement[] = [<Rect key="bg" x={0} y={0} width={size} height={size} color="#FAFAFA" />];
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          if ((r + c) % 2 === 0) {
            cells.push(<Rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} color="#111118" />);
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
        <Rect key="bg" x={0} y={0} width={size} height={size} color="#FFF8ED" />,
        ...pieces.map(([x, y, w, h], i) => (
          <Rect
            key={i}
            x={Math.round(x * size)}
            y={Math.round(y * size)}
            width={w * pixel}
            height={h * pixel}
            color={['#F568A3', '#6AC9E7', '#F4CA55', '#9FD085', '#AE8DDB'][i % 5]}
          />
        )),
      ];
    }
    case 'STRIPE': {
      const step = size / 4;
      const lines: ReactElement[] = [<Rect key="bg" x={0} y={0} width={size} height={size} color="#FFE89C" />];
      for (let i = -4; i <= 4; i++) {
        lines.push(
          <Line key={i} p1={vec(i * step, 0)} p2={vec(i * step + size, size)} color="#F38EB7" strokeWidth={step / 2} />,
        );
      }
      return lines;
    }
    case 'STARS':
      return [
        <Rect key="bg" x={0} y={0} width={size} height={size} color="#2A1F5C" />,
        ...drawStars(size, '#FFEE66', '#BB77FF'),
      ];
    case 'POLKA': {
      // 가장자리 밖에서 시작하는 점도 그대로 그려 타일이 잘린 것처럼 자연스럽게 보인다.
      const centers = [
        [-0.015, 0.12],
        [0.26, -0.02],
        [0.67, 0.02],
        [1.01, 0.25],
        [0.18, 0.4],
        [0.55, 0.31],
        [0.87, 0.51],
        [0.04, 0.73],
        [0.4, 0.67],
        [0.65, 0.89],
        [0.25, 1.01],
        [1.015, 0.94],
      ] as const;
      const pixel = size / 48;
      const dot = Skia.PathBuilder.Make();
      for (const [x, y] of centers) {
        const left = Math.round(x * 48) - 3;
        const top = Math.round(y * 48) - 3;
        // 6×6 원형 도트의 계단 모서리.
        dot.addRect({ x: (left + 1) * pixel, y: top * pixel, width: 4 * pixel, height: 6 * pixel });
        dot.addRect({ x: left * pixel, y: (top + 1) * pixel, width: 6 * pixel, height: 4 * pixel });
      }
      return [
        <Rect key="bg" x={0} y={0} width={size} height={size} color="#111118" />,
        <Path key="dots" path={dot.detach()} color="#FFFFFF" />,
      ];
    }
    case 'BURST': {
      const grid = 48;
      const pixel = size / grid;
      const rays = Skia.PathBuilder.Make();
      // 픽셀 칸의 각도로 방사 무늬를 분류하고 한 Path로 합쳐 작은 아바타에서도 렌더 비용을 제한한다.
      for (let y = 0; y < grid; y++) {
        let run = -1;
        for (let x = 0; x <= grid; x++) {
          const angle = Math.atan2(y + 0.5 - grid / 2, x + 0.5 - grid / 2) + Math.PI;
          const dark = x < grid && Math.floor((angle / (Math.PI * 2)) * 32) % 2 === 0;
          if (dark && run < 0) run = x;
          if (!dark && run >= 0) {
            rays.addRect({ x: run * pixel, y: y * pixel, width: (x - run) * pixel, height: pixel });
            run = -1;
          }
        }
      }
      return [
        <Rect key="bg" x={0} y={0} width={size} height={size} color="#3636C9" />,
        <Path key="rays" path={rays.detach()} color="#07075D" />,
      ];
    }
    default:
      return [];
  }
}

// 캐릭터 뒤 배경 패턴 — 상점 미리보기·대기실·게임 칸에서 같은 모양으로 그린다
export function CosmeticBackground({ pattern, color, artwork, size }: Props) {
  const shapes = useMemo(() => drawPattern(pattern, size, color), [pattern, size, color]);
  if (artwork) {
    return <Image source={BACKGROUND_ARTWORKS[artwork]} style={{ width: size, height: size }} resizeMode="cover" />;
  }
  return <Canvas style={{ width: size, height: size }}>{shapes}</Canvas>;
}
