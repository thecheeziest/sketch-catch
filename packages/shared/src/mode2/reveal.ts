import type { Mode2StepContent } from '../types/game.js';
import type { Stroke } from '../types/stroke.js';

// 정답 공개식 발표 1건 — 원조자는 제시어 + 첫 그림, 이후 참가자는 정답(추측) + 그 정답을 다시 그린 그림
export type Mode2RevealEntry = {
  authorId: string;
  text: string;
  strokes: Stroke[];
  isOwner: boolean;
};

// 시트 스텝은 [제시어, 그림, 정답, 그림, ...] 순서로 쌓이므로 (글, 그림) 2개씩 묶는다
export function buildRevealEntries(steps: readonly Mode2StepContent[]): Mode2RevealEntry[] {
  const entries: Mode2RevealEntry[] = [];
  for (let i = 0; i < steps.length; i += 2) {
    const textStep = steps[i];
    const drawStep = steps[i + 1];
    if (!textStep || textStep.kind === 'DRAW') continue;
    entries.push({
      authorId: textStep.authorId,
      text: textStep.text,
      strokes: drawStep?.kind === 'DRAW' ? drawStep.strokes : [],
      isOwner: i === 0,
    });
  }
  return entries;
}

export type StrokeTimeline = { start: number; end: number };

// 첫 획 시작 ~ 마지막 점 사이를 재생 구간으로 잡는다 (캔버스를 연 뒤 망설인 시간은 재생하지 않는다)
export function getStrokeTimeline(strokes: readonly Stroke[]): StrokeTimeline {
  let start = Number.POSITIVE_INFINITY;
  let end = 0;
  for (const stroke of strokes) {
    start = Math.min(start, stroke.startTime);
    end = Math.max(end, stroke.startTime);
    for (const point of stroke.points) end = Math.max(end, point.t);
  }
  if (!Number.isFinite(start)) return { start: 0, end: 0 };
  return { start, end: Math.max(end, start) };
}

// 재생 진행률(0~1) 시점까지 그려진 stroke만 남긴다. 진행 중인 stroke는 그 시점까지의 점만 포함한다.
export function sliceStrokesAt(strokes: readonly Stroke[], timeline: StrokeTimeline, progress: number): Stroke[] {
  if (progress >= 1) return [...strokes];
  const cutoff = timeline.start + (timeline.end - timeline.start) * Math.max(0, progress);
  const visible: Stroke[] = [];
  for (const stroke of strokes) {
    if (stroke.startTime > cutoff) continue;
    if (stroke.paintSpans) {
      visible.push(stroke);
      continue;
    }
    const points = stroke.points.filter(point => point.t <= cutoff);
    if (points.length === 0) continue;
    visible.push(points.length === stroke.points.length ? stroke : { ...stroke, points });
  }
  return visible;
}
