import { AlphaType, ColorType, PaintStyle, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia';
import { findPaintSpans, MAX_PAINT_SPANS, type PaintSpan, type Point } from '@sketch-catch/shared';
import { buildPaintPath, buildStrokePath } from '@/shared/lib/strokePath';

type PaintSource = { color: string; width: number; points: Point[]; paintSpans?: PaintSpan[] };

// Raster는 탭할 때만 생성한다. 브러시 프레임마다 픽셀을 읽지 않는다.
export function createPaintSpans(
  strokes: PaintSource[],
  canvasWidth: number,
  canvasHeight: number,
  x: number,
  y: number,
  color: string,
): PaintSpan[] {
  const w = 384;
  const h = Math.max(1, Math.min(1024, Math.round((w * canvasHeight) / canvasWidth)));
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) throw new Error('페인트 영역을 만들 수 없어요. 다시 시도해 주세요.');
  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color('#FFFFFF'));
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStrokeCap(StrokeCap.Round);
  paint.setStrokeJoin(StrokeJoin.Round);
  try {
    for (const stroke of strokes) {
      const path = stroke.paintSpans ? buildPaintPath(stroke.paintSpans, w, h) : buildStrokePath(stroke.points, w, h);
      if (!path) continue;
      paint.setColor(Skia.Color(stroke.color));
      paint.setStyle(stroke.paintSpans ? PaintStyle.Fill : PaintStyle.Stroke);
      paint.setStrokeWidth((stroke.width * w) / canvasWidth);
      canvas.drawPath(path, paint);
      path.dispose();
    }
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    try {
      const pixels = snapshot.readPixels(0, 0, {
        width: w,
        height: h,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Unpremul,
      });
      if (!(pixels instanceof Uint8Array)) throw new Error('페인트 영역을 읽을 수 없어요. 다시 시도해 주세요.');
      const px = Math.min(w - 1, Math.max(0, Math.floor((x / canvasWidth) * w)));
      const py = Math.min(h - 1, Math.max(0, Math.floor((y / canvasHeight) * h)));
      const offset = (py * w + px) * 4;
      const fill = Skia.Color(color);
      if ([0, 1, 2].every(channel => Math.abs(pixels[offset + channel]! - fill[channel]! * 255) <= 1)) return [];
      const spans = findPaintSpans(pixels, w, h, px, py);
      if (spans.length > MAX_PAINT_SPANS) throw new Error('영역이 너무 복잡해요. 더 작은 영역을 선택해 주세요.');
      return spans;
    } finally {
      snapshot.dispose();
    }
  } finally {
    paint.dispose();
    surface.dispose();
  }
}
