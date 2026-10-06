import { Skia, type SkPath } from '@shopify/react-native-skia';

type NormalizedPoint = { x: number; y: number };

// 0~1로 정규화된 stroke 좌표를 캔버스 크기(w×h)에 맞춘 Skia 경로로 변환한다.
// SkPath 직접 변경(moveTo/lineTo)은 Skia 2.6부터 deprecated — PathBuilder로 만든다.
export function buildStrokePath(points: readonly NormalizedPoint[], w: number, h: number): SkPath | null {
  const first = points[0];
  if (!first) return null;
  const builder = Skia.PathBuilder.Make().moveTo(first.x * w, first.y * h);
  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    if (pt) builder.lineTo(pt.x * w, pt.y * h);
  }
  return builder.build();
}
