import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createCanvas, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import type { GifEncoderInstance } from 'gifenc';
import type { Mode2StepContent, Stroke } from '@sketch-catch/shared';

// gifenc(CJS, esbuild __export 헬퍼 패턴)는 cjs-module-lexer가 정적 분석하지 못해
// named import(`import { GIFEncoder } from 'gifenc'`)가 plain Node ESM 런타임에서 undefined로 깨짐
// (Vitest는 자체 트랜스폼으로 이 문제를 우회해 테스트만으로는 발견 불가 — 실서버 실행 시 재현되는 실제 버그, Rule 1)
// createRequire로 CJS 그대로 로드해 로더 종류와 무관하게 안전하게 동작시킴
const require = createRequire(import.meta.url);
const { GIFEncoder, quantize, applyPalette } = require('gifenc') as {
  GIFEncoder: (options?: { initialCapacity?: number; auto?: boolean }) => GifEncoderInstance;
  quantize: (data: Uint8Array | Uint8ClampedArray, maxColors: number, options?: Record<string, unknown>) => number[][];
  applyPalette: (data: Uint8Array | Uint8ClampedArray, palette: number[][], format?: string) => Uint8Array;
};

// D-14: 텍스트 카드 프레임(제시어/답변) + 스트로크 배속 재생 프레임을 하나의 GIF로 합성
// (DEVELOPER.md §8.3 strokesToGif 확장 — UI-SPEC "GIF Text Frame Spec" 시각 파라미터 그대로 사용)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_PATH = path.join(__dirname, '../../assets/fonts/Galmuri11.ttf');
const FONT_FAMILY = 'Galmuri11';

const TEXT_BG = '#FAFAFA';
const TEXT_COLOR = '#222222';
const DRAW_BG = '#FFFFFF';
const TEXT_FONT_SIZE = 28;
const TEXT_LINE_HEIGHT = 36;
const TEXT_H_PADDING = 64;

let fontRegistered = false;

// Pitfall 2 대응 — 시스템 폰트 미의존, 모듈 로드 시 명시 등록 (idempotent)
function ensureFontRegistered(): void {
  if (fontRegistered) return;
  if (!GlobalFonts.has(FONT_FAMILY)) {
    GlobalFonts.registerFromPath(FONT_PATH, FONT_FAMILY);
  }
  fontRegistered = true;
}

export type SheetToGifOptions = {
  steps: Mode2StepContent[];
  width?: number;
  height?: number;
  fps?: number;
  textFrameDurationMs?: number; // D-14 텍스트 카드 표시 시간 (UI-SPEC 기본 1500ms)
  drawFrameDurationMs?: number; // 그림 단계 배속 압축 재생 총 시간 (UI-SPEC 기본 2500ms)
};

export async function sheetToGif(opts: SheetToGifOptions): Promise<Buffer> {
  ensureFontRegistered();

  const width = opts.width ?? 480;
  const height = opts.height ?? 480;
  const fps = opts.fps ?? 12;
  const textFrameDurationMs = opts.textFrameDurationMs ?? 1500;
  const drawFrameDurationMs = opts.drawFrameDurationMs ?? 2500;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const enc = GIFEncoder();

  for (const step of opts.steps) {
    if (step.kind === 'PROMPT' || step.kind === 'ANSWER') {
      renderTextFrame(ctx, step.text, width, height);
      writeCanvasFrame(enc, ctx, width, height, textFrameDurationMs);
    } else {
      renderDrawFrames(enc, ctx, step.strokes, width, height, fps, drawFrameDurationMs);
    }
  }

  enc.finish();
  return Buffer.from(enc.bytes());
}

// Pitfall 2 스모크 테스트 전용 디버그 헬퍼 — GIF 인코딩 없이 텍스트 프레임 픽셀만 확인
export function debugRenderTextFrame(
  text: string,
  width = 480,
  height = 480,
): { data: Uint8ClampedArray; width: number; height: number } {
  ensureFontRegistered();
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  renderTextFrame(ctx, text, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function writeCanvasFrame(
  enc: GifEncoderInstance,
  ctx: SKRSContext2D,
  width: number,
  height: number,
  delay: number,
): void {
  const { data } = ctx.getImageData(0, 0, width, height);
  const palette = quantize(data, 256);
  const indexed = applyPalette(data, palette);
  enc.writeFrame(indexed, width, height, { palette, delay });
}

function renderTextFrame(ctx: SKRSContext2D, text: string, width: number, height: number): void {
  ctx.fillStyle = TEXT_BG;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = `${TEXT_FONT_SIZE}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = wrapText(ctx, text, width - TEXT_H_PADDING);
  const startY = height / 2 - ((lines.length - 1) * TEXT_LINE_HEIGHT) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, startY + i * TEXT_LINE_HEIGHT);
  });
}

// ctx.measureText 기반 word-wrap (Don't-Hand-Roll: 측정만 라이브러리에 위임, 줄바꿈 로직만 직접 구현)
// 공백 포함 텍스트는 단어 단위, 한글처럼 공백 없는 텍스트는 글자 단위로 줄바꿈
function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const hasSpace = text.includes(' ');
  const units = hasSpace ? text.split(' ') : text.split('');
  const separator = hasSpace ? ' ' : '';

  const lines: string[] = [];
  let current = '';
  for (const unit of units) {
    const candidate = current ? `${current}${separator}${unit}` : unit;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = unit;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

// 그림 단계: 전체 stroke 타임라인을 drawFrameDurationMs로 압축 배속 재생
// (DEVELOPER.md §8.3 drawIncremental 개념 — 프레임마다 누적된 점까지 다시 그려 각 프레임 완성)
function renderDrawFrames(
  enc: GifEncoderInstance,
  ctx: SKRSContext2D,
  strokes: Stroke[],
  width: number,
  height: number,
  fps: number,
  drawFrameDurationMs: number,
): void {
  const frameCount = Math.max(1, Math.ceil(drawFrameDurationMs / (1000 / fps)));
  const frameDelay = Math.round(drawFrameDurationMs / frameCount);

  let maxT = 0;
  for (const stroke of strokes) {
    if (stroke.startTime > maxT) maxT = stroke.startTime;
    for (const point of stroke.points) {
      if (point.t > maxT) maxT = point.t;
    }
  }
  if (maxT === 0) maxT = 1;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let frame = 0; frame < frameCount; frame++) {
    const cutoffT = ((frame + 1) / frameCount) * maxT;

    ctx.fillStyle = DRAW_BG;
    ctx.fillRect(0, 0, width, height);

    for (const stroke of strokes) {
      if (stroke.paintSpans) {
        if (stroke.startTime > cutoffT) continue;
        ctx.fillStyle = stroke.color;
        for (const span of stroke.paintSpans)
          ctx.fillRect(span.x * width, span.y * height, span.width * width, span.height * height);
        continue;
      }
      const visiblePoints = stroke.points.filter(p => p.t <= cutoffT);
      const first = visiblePoints[0];
      if (visiblePoints.length < 2 || !first) continue;

      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = Math.max(1, stroke.width * width);
      ctx.beginPath();
      ctx.moveTo(first.x * width, first.y * height);
      for (let i = 1; i < visiblePoints.length; i++) {
        const point = visiblePoints[i];
        if (!point) continue;
        ctx.lineTo(point.x * width, point.y * height);
      }
      ctx.stroke();
    }

    writeCanvasFrame(enc, ctx, width, height, frameDelay);
  }
}
