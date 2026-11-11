import {
  createPicture,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkPath,
  type SkPicture,
} from '@shopify/react-native-skia';
import type { PaintSpan } from '@sketch-catch/shared';

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

// stroke 두께를 캔버스 px로 변환 — 1 미만은 캔버스 너비 대비 비율, 1 이상은 구버전 앱이 보낸 px 그대로
export function toCanvasStrokeWidth(width: number, canvasWidth: number): number {
  return width < 1 ? width * canvasWidth : width;
}

export function buildPaintPath(spans: readonly PaintSpan[], w: number, h: number): SkPath {
  const builder = Skia.PathBuilder.Make();
  for (const span of spans) builder.addRect(Skia.XYWHRect(span.x * w, span.y * h, span.width * w, span.height * h));
  return builder.build();
}

type PictureStroke = {
  color: string;
  width: number;
  points: readonly NormalizedPoint[];
  paintSpans?: readonly PaintSpan[];
};

// 다 그린 획을 한 장의 Picture로 굳힌다 — 획이 늘어도 매 프레임 그리는 요소는 1개라 렌더 비용이 일정하다
export function createStrokesPicture(strokes: readonly PictureStroke[], w: number, h: number): SkPicture {
  return createPicture(
    canvas => {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setStrokeCap(StrokeCap.Round);
      paint.setStrokeJoin(StrokeJoin.Round);
      for (const stroke of strokes) {
        const path = stroke.paintSpans ? buildPaintPath(stroke.paintSpans, w, h) : buildStrokePath(stroke.points, w, h);
        if (!path) continue;
        paint.setColor(Skia.Color(stroke.color));
        paint.setStyle(stroke.paintSpans ? PaintStyle.Fill : PaintStyle.Stroke);
        paint.setStrokeWidth(toCanvasStrokeWidth(stroke.width, w));
        canvas.drawPath(path, paint);
      }
    },
    { width: w, height: h },
  );
}
