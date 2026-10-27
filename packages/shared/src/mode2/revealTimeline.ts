import {
  MODE2_REVEAL_DRAW_MS,
  MODE2_REVEAL_GUESS_MS,
  MODE2_REVEAL_MOVE_MS,
  MODE2_REVEAL_OWNER_LEAD_MS,
  MODE2_REVEAL_SHEET_GAP_MS,
} from '../constants/game.js';

// 시트 1장 공개식의 진행 단계 — wait(테두리 이동) → [lead(상단 앞말) → draw(스케치 재생) → guess(하단 정답)] × 발표 수
export type RevealPhase = 'wait' | 'lead' | 'draw' | 'guess';

export type RevealPosition = { entryIndex: number; phase: RevealPhase; progress: number };

function leadMs(entryIndex: number): number {
  return entryIndex === 0 ? MODE2_REVEAL_OWNER_LEAD_MS : MODE2_REVEAL_MOVE_MS;
}

export function getRevealEntryDurationMs(entryIndex: number): number {
  return leadMs(entryIndex) + MODE2_REVEAL_DRAW_MS + MODE2_REVEAL_GUESS_MS;
}

export function getSheetRevealDurationMs(entryCount: number): number {
  let total = MODE2_REVEAL_SHEET_GAP_MS;
  for (let i = 0; i < entryCount; i++) total += getRevealEntryDurationMs(i);
  return total;
}

// 시트 시작 후 경과 시간 → 지금 발표 위치. 끝을 넘기면 마지막 발표의 완성 장면에 머문다
export function getRevealPosition(sheetElapsedMs: number, entryCount: number): RevealPosition {
  let t = sheetElapsedMs - MODE2_REVEAL_SHEET_GAP_MS;
  if (t < 0 || entryCount === 0) return { entryIndex: 0, phase: 'wait', progress: 0 };
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex++) {
    const segments: ReadonlyArray<{ phase: Exclude<RevealPhase, 'wait'>; ms: number }> = [
      { phase: 'lead', ms: leadMs(entryIndex) },
      { phase: 'draw', ms: MODE2_REVEAL_DRAW_MS },
      { phase: 'guess', ms: MODE2_REVEAL_GUESS_MS },
    ];
    for (const segment of segments) {
      if (t < segment.ms) return { entryIndex, phase: segment.phase, progress: t / segment.ms };
      t -= segment.ms;
    }
  }
  return { entryIndex: entryCount - 1, phase: 'guess', progress: 1 };
}
