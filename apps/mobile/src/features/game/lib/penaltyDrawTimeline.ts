import type { FeedbackName } from '@/shared/config/audio';
import { PENALTY_DRAW_ROUNDS, PENALTY_DRAW_SLOWDOWN, PENALTY_DRAW_TIMING } from '@/features/game/config/penaltyDraw';

export type PenaltyDrawPhase = 'intro' | 'dark' | 'cycle' | 'pause' | 'reveal' | 'promote' | 'done';

export type PenaltyDrawFrame = {
  phase: PenaltyDrawPhase;
  // 핀 조명이 비추는 후보 index (cycle 단계에서만 0 이상)
  spot: number;
};

export type PenaltyDrawEvent = {
  at: number;
  frame: PenaltyDrawFrame;
  sound?: FeedbackName;
};

export const PENALTY_DRAW_DONE_FRAME: PenaltyDrawFrame = { phase: 'done', spot: -1 };

// 순회 고정 길이를 바퀴·후보 수로 나눈 조명 간격 — 마지막 바퀴만 점점 느려진다
export function getSpotGaps(candidateCount: number): number[] {
  const steady = (PENALTY_DRAW_ROUNDS - 1) * candidateCount;
  const weights = Array.from({ length: steady }, () => 1);
  for (let i = 0; i < candidateCount; i++) {
    const progress = candidateCount === 1 ? 1 : i / (candidateCount - 1);
    weights.push(PENALTY_DRAW_SLOWDOWN.FROM + (PENALTY_DRAW_SLOWDOWN.TO - PENALTY_DRAW_SLOWDOWN.FROM) * progress);
  }
  const unit = PENALTY_DRAW_TIMING.SPOT_TOTAL_MS / weights.reduce((sum, w) => sum + w, 0);
  return weights.map(w => Math.round(w * unit));
}

// 추첨 연출의 화면 상태·효과음 이벤트 목록 (시간순)
export function buildPenaltyDrawTimeline(candidateCount: number): PenaltyDrawEvent[] {
  const timing = PENALTY_DRAW_TIMING;
  const events: PenaltyDrawEvent[] = [
    { at: 0, frame: { phase: 'intro', spot: -1 }, sound: 'drawSting' },
    { at: timing.DRUM_START_MS, frame: { phase: 'intro', spot: -1 }, sound: 'drawDrumroll' },
    { at: timing.LIGHTS_OFF_MS, frame: { phase: 'dark', spot: -1 }, sound: 'lightOff' },
  ];

  let cursor: number = timing.SPOT_START_MS;
  getSpotGaps(candidateCount).forEach((gap, i) => {
    events.push({ at: cursor, frame: { phase: 'cycle', spot: i % candidateCount }, sound: 'spotlight' });
    cursor += gap;
  });

  events.push(
    { at: cursor, frame: { phase: 'pause', spot: -1 } },
    { at: timing.REVEAL_MS, frame: { phase: 'reveal', spot: -1 }, sound: 'drawFail' },
    { at: timing.PROMOTE_MS, frame: { phase: 'promote', spot: -1 }, sound: 'drawPromote' },
    { at: timing.DONE_MS, frame: PENALTY_DRAW_DONE_FRAME },
  );
  return events;
}
