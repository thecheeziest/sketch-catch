import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createCanvas, GlobalFonts, loadImage, type Image, type SKRSContext2D } from '@napi-rs/canvas';
import type { GifEncoderInstance } from 'gifenc';
import {
  BRUSH_SPRITE,
  BULB_SPRITE,
  MODE2_REVEAL_DRAW_MS,
  MODE2_REVEAL_HOLD_MS,
  MODE2_REVEAL_LEAD_MS,
  MODE2_REVEAL_WORD_MS,
  PALETTE_SPRITE,
  QUESTION_SPRITE,
  buildRevealEntries,
  getSpritePixels,
  getSpriteSize,
  getStrokeTimeline,
  sliceStrokesAt,
  type Mode2StepContent,
  type PixelSpriteData,
  type Stroke,
} from '@sketch-catch/shared';

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

// 정답 공개식을 앱 화면과 같은 구성(원조자 + 말풍선 / 스케치북 / 맞히는 사람 + 말풍선)으로 GIF에 담는다.
// 타임라인은 앱 공개식과 같은 shared 상수를 쓴다.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_PATH = path.join(__dirname, '../../assets/fonts/Galmuri11.ttf');
const CHARACTER_DIR = path.join(__dirname, '../../assets/characters');
const FONT_FAMILY = 'Galmuri11';

const COLORS = {
  BG: '#171122',
  INK: '#0F0A19',
  BUBBLE: '#FFFFFF',
  BUBBLE_TEXT: '#1D1629',
  SKETCH: '#FFFFFF',
  EMPTY_TEXT: '#B9AED2',
  PLACEHOLDER: '#4A3A5C',
} as const;

const LEAD_OWNER = '내가 그릴 그림은..';
const LEAD_GUESSER = '이 그림은 아마..';
const UNKNOWN_TEXT = '???';

const BASE_WIDTH = 360;
const BASE_FONT_SIZE = 17;
const MIN_FONT_SIZE = 11;
const BORDER = 3;

let fontRegistered = false;

// Pitfall 2 대응 — 시스템 폰트 미의존, 모듈 로드 시 명시 등록 (idempotent)
function ensureFontRegistered(): void {
  if (fontRegistered) return;
  if (!GlobalFonts.has(FONT_FAMILY)) {
    GlobalFonts.registerFromPath(FONT_PATH, FONT_FAMILY);
  }
  fontRegistered = true;
}

const characterCache = new Map<string, Image | null>();

async function loadCharacter(characterId: string): Promise<Image | null> {
  const cached = characterCache.get(characterId);
  if (cached !== undefined) return cached;
  // characterId는 서버가 검증한 값이지만 경로 조합 전에 한 번 더 제한한다
  const file = path.join(CHARACTER_DIR, `${characterId.replace(/[^a-z]/g, '')}.png`);
  const image = existsSync(file) ? await loadImage(file) : null;
  characterCache.set(characterId, image);
  return image;
}

export type RevealGifPlayer = { id: string; nickname: string; characterId: string };

export type RevealToGifOptions = {
  steps: Mode2StepContent[];
  players: RevealGifPlayer[];
  width?: number;
  fps?: number;
};

type Layout = {
  width: number;
  height: number;
  scale: number;
  pad: number;
  charSize: number;
  bubbleH: number;
  ownerY: number;
  ownerBubbleY: number;
  sketch: { x: number; y: number; size: number };
  guesserBubbleY: number;
  guesserY: number;
};

function makeLayout(width: number): Layout {
  const scale = width / BASE_WIDTH;
  const pad = Math.round(12 * scale);
  const charSize = Math.round(52 * scale);
  const bubbleH = Math.round(40 * scale);
  const gap = Math.round(10 * scale);
  const ownerY = pad;
  const ownerBubbleY = ownerY + charSize + Math.round(8 * scale);
  const sketchSize = width - pad * 2;
  const sketchY = ownerBubbleY + bubbleH + gap;
  const guesserBubbleY = sketchY + sketchSize + gap;
  const guesserY = guesserBubbleY + bubbleH + Math.round(8 * scale);
  return {
    width,
    height: guesserY + charSize + pad,
    scale,
    pad,
    charSize,
    bubbleH,
    ownerY,
    ownerBubbleY,
    sketch: { x: pad, y: sketchY, size: sketchSize },
    guesserBubbleY,
    guesserY,
  };
}

type Scene = {
  owner: Image | null;
  ownerText: string;
  sway: number;
  strokes: Stroke[];
  emptySketch: boolean;
  guesser: { image: Image | null; text: string; icon: PixelSpriteData | null } | null;
};

export async function revealToGif(opts: RevealToGifOptions): Promise<Buffer> {
  ensureFontRegistered();

  const layout = makeLayout(opts.width ?? BASE_WIDTH);
  const fps = opts.fps ?? 10;
  const canvas = createCanvas(layout.width, layout.height);
  const ctx = canvas.getContext('2d');
  const enc = GIFEncoder();

  const entries = buildRevealEntries(opts.steps);
  const imageOf = async (userId: string): Promise<Image | null> => {
    const player = opts.players.find(p => p.id === userId);
    return player ? loadCharacter(player.characterId) : null;
  };
  const owner = entries[0] ? await imageOf(entries[0].authorId) : null;
  const ownerFullText = `${LEAD_OWNER} ${entries[0]?.text || UNKNOWN_TEXT}!`;

  let frameIndex = 0;
  const write = (scene: Omit<Scene, 'owner' | 'sway'>, delay: number): void => {
    renderScene(ctx, layout, { ...scene, owner, sway: frameIndex % 4 < 2 ? -1 : 1 });
    writeCanvasFrame(enc, ctx, layout.width, layout.height, delay);
    frameIndex += 1;
  };

  for (const [index, entry] of entries.entries()) {
    const word = entry.text || UNKNOWN_TEXT;
    const previous = entries[index - 1]?.strokes ?? [];
    const guesserImage = entry.isOwner ? null : await imageOf(entry.authorId);
    const guesserFull = entry.isOwner ? null : { image: guesserImage, text: `${LEAD_GUESSER} ${word}!`, icon: null };

    // ① 앞말 → ② 단어 공개 (맞히는 사람 차례에는 직전 그림을 보며 추측한다)
    if (entry.isOwner) {
      write({ ownerText: LEAD_OWNER, strokes: [], emptySketch: false, guesser: null }, MODE2_REVEAL_LEAD_MS);
      write({ ownerText: ownerFullText, strokes: [], emptySketch: false, guesser: null }, MODE2_REVEAL_WORD_MS);
    } else {
      const base = { ownerText: ownerFullText, strokes: previous, emptySketch: previous.length === 0 };
      write(
        { ...base, guesser: { image: guesserImage, text: LEAD_GUESSER, icon: QUESTION_SPRITE } },
        MODE2_REVEAL_LEAD_MS,
      );
      write(
        { ...base, guesser: { image: guesserImage, text: guesserFull!.text, icon: BULB_SPRITE } },
        MODE2_REVEAL_WORD_MS,
      );
    }

    // ③ 스케치 과정 재생 → ④ 여운
    if (entry.strokes.length === 0) {
      write(
        { ownerText: ownerFullText, strokes: [], emptySketch: true, guesser: guesserFull },
        MODE2_REVEAL_DRAW_MS + MODE2_REVEAL_HOLD_MS,
      );
      continue;
    }
    const timeline = getStrokeTimeline(entry.strokes);
    const frameCount = Math.max(1, Math.ceil(MODE2_REVEAL_DRAW_MS / (1000 / fps)));
    const frameDelay = Math.round(MODE2_REVEAL_DRAW_MS / frameCount);
    for (let frame = 0; frame < frameCount; frame++) {
      const strokes = sliceStrokesAt(entry.strokes, timeline, (frame + 1) / frameCount);
      write({ ownerText: ownerFullText, strokes, emptySketch: false, guesser: guesserFull }, frameDelay);
    }
    write(
      { ownerText: ownerFullText, strokes: entry.strokes, emptySketch: false, guesser: guesserFull },
      MODE2_REVEAL_HOLD_MS,
    );
  }

  enc.finish();
  return Buffer.from(enc.bytes());
}

// Pitfall 2 스모크 테스트 전용 디버그 헬퍼 — GIF 인코딩 없이 말풍선 글자 픽셀만 확인
export function debugRenderTextFrame(
  text: string,
  width = 480,
  height = 480,
): { data: Uint8ClampedArray; width: number; height: number } {
  ensureFontRegistered();
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COLORS.BUBBLE;
  ctx.fillRect(0, 0, width, height);
  drawFittedText(ctx, text, width / 2, height / 2, width - 32, BASE_FONT_SIZE * 2);
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

function renderScene(ctx: SKRSContext2D, layout: Layout, scene: Scene): void {
  const { width, scale, charSize, pad } = layout;
  ctx.fillStyle = COLORS.BG;
  ctx.fillRect(0, 0, width, layout.height);

  // 원조자 — 왼손 팔레트, 오른손 붓. 프레임마다 좌우로 살짝 흔들려 그림 그리는 느낌을 낸다
  const px = Math.max(2, Math.round(3 * scale));
  const ownerX = Math.round((width - charSize) / 2 + scene.sway * 3 * scale);
  drawCharacter(ctx, scene.owner, ownerX, layout.ownerY, charSize);
  const palette = getSpriteSize(PALETTE_SPRITE);
  drawSprite(ctx, PALETTE_SPRITE, ownerX - palette.width * px - 2, layout.ownerY + charSize - palette.height * px, px);
  const brush = getSpriteSize(BRUSH_SPRITE);
  drawSprite(ctx, BRUSH_SPRITE, ownerX + charSize + 2, layout.ownerY + charSize - brush.height * px, px);

  drawBubble(ctx, pad, layout.ownerBubbleY, width - pad * 2, layout.bubbleH, width / 2, 'up', scene.ownerText, scale);
  drawSketchbook(ctx, layout, scene.strokes, scene.emptySketch);

  if (!scene.guesser) return;
  drawBubble(
    ctx,
    pad,
    layout.guesserBubbleY,
    width - pad * 2,
    layout.bubbleH,
    width / 2,
    'down',
    scene.guesser.text,
    scale,
  );
  const guesserX = Math.round((width - charSize) / 2);
  drawCharacter(ctx, scene.guesser.image, guesserX, layout.guesserY, charSize);
  if (scene.guesser.icon) {
    const icon = getSpriteSize(scene.guesser.icon);
    drawSprite(
      ctx,
      scene.guesser.icon,
      guesserX + charSize + 6,
      layout.guesserY + (charSize - icon.height * px) / 2,
      px,
    );
  }
}

function drawCharacter(ctx: SKRSContext2D, image: Image | null, x: number, y: number, size: number): void {
  if (image) {
    ctx.drawImage(image, x, y, size, size);
    return;
  }
  ctx.fillStyle = COLORS.PLACEHOLDER;
  ctx.fillRect(x, y, size, size);
}

function drawSprite(ctx: SKRSContext2D, sprite: PixelSpriteData, x: number, y: number, px: number): void {
  for (const pixel of getSpritePixels(sprite)) {
    ctx.fillStyle = pixel.color;
    ctx.fillRect(Math.round(x + pixel.x * px), Math.round(y + pixel.y * px), px, px);
  }
}

// 앱의 PixelFrame과 같은 각진 테두리 + 계단식 꼬리
function drawBubble(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tailX: number,
  tail: 'up' | 'down',
  text: string,
  scale: number,
): void {
  const b = Math.max(2, Math.round(BORDER * scale));
  ctx.fillStyle = COLORS.INK;
  ctx.fillRect(x + b, y, w - b * 2, h);
  ctx.fillRect(x, y + b, w, h - b * 2);
  ctx.fillStyle = COLORS.BUBBLE;
  ctx.fillRect(x + b, y + b, w - b * 2, h - b * 2);

  for (let step = 0; step < 3; step++) {
    const outer = (3 - step) * 2 * b;
    const inner = outer - b * 2;
    const rowY = tail === 'up' ? y - (step + 1) * b : y + h + step * b;
    ctx.fillStyle = COLORS.INK;
    ctx.fillRect(tailX - outer / 2, rowY, outer, b);
    if (inner <= 0) continue;
    ctx.fillStyle = COLORS.BUBBLE;
    ctx.fillRect(tailX - inner / 2, rowY, inner, b);
  }
  // 꼬리와 몸통 사이 테두리를 터서 한 덩어리로 보이게 한다
  ctx.fillStyle = COLORS.BUBBLE;
  ctx.fillRect(tailX - b * 2, tail === 'up' ? y : y + h - b, b * 4, b);

  ctx.fillStyle = COLORS.BUBBLE_TEXT;
  drawFittedText(ctx, text, x + w / 2, y + h / 2, w - b * 6, Math.round(BASE_FONT_SIZE * scale));
}

// 말풍선 한 줄에 맞도록 글자 크기를 줄이고, 최소 크기로도 넘치면 말줄임한다
function drawFittedText(
  ctx: SKRSContext2D,
  text: string,
  centerX: number,
  centerY: number,
  maxWidth: number,
  baseSize: number,
): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = baseSize;
  ctx.font = `${size}px ${FONT_FAMILY}`;
  while (size > MIN_FONT_SIZE && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = `${size}px ${FONT_FAMILY}`;
  }
  let fitted = text;
  while (fitted.length > 1 && ctx.measureText(fitted).width > maxWidth) {
    fitted = `${fitted.slice(0, -2)}…`;
  }
  ctx.fillText(fitted, centerX, centerY);
}

function drawSketchbook(ctx: SKRSContext2D, layout: Layout, strokes: Stroke[], empty: boolean): void {
  const { x, y, size } = layout.sketch;
  const b = Math.max(2, Math.round(BORDER * layout.scale));
  ctx.fillStyle = COLORS.INK;
  ctx.fillRect(x - b, y - b, size + b * 2, size + b * 2);
  ctx.fillStyle = COLORS.SKETCH;
  ctx.fillRect(x, y, size, size);

  if (empty) {
    ctx.fillStyle = COLORS.EMPTY_TEXT;
    drawFittedText(
      ctx,
      '그림이 없어요',
      x + size / 2,
      y + size / 2,
      size - 32,
      Math.round(BASE_FONT_SIZE * layout.scale),
    );
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const stroke of strokes) {
    if (stroke.paintSpans) {
      ctx.fillStyle = stroke.color;
      for (const span of stroke.paintSpans)
        ctx.fillRect(x + span.x * size, y + span.y * size, span.width * size, span.height * size);
      continue;
    }
    const first = stroke.points[0];
    if (!first) continue;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = Math.max(1, stroke.width <= 1 ? stroke.width * size : stroke.width);
    ctx.beginPath();
    ctx.moveTo(x + first.x * size, y + first.y * size);
    // 점 1개짜리 탭도 보이도록 같은 위치로 한 번 더 이어 둥근 점을 찍는다
    if (stroke.points.length === 1) ctx.lineTo(x + first.x * size + 0.01, y + first.y * size);
    for (const point of stroke.points.slice(1)) ctx.lineTo(x + point.x * size, y + point.y * size);
    ctx.stroke();
  }
  ctx.restore();
}
