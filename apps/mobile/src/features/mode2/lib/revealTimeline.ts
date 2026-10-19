import {
  MODE2_REVEAL_DRAW_MS,
  MODE2_REVEAL_ENTRY_MS,
  MODE2_REVEAL_HOLD_MS,
  MODE2_REVEAL_LEAD_MS,
  MODE2_REVEAL_SHEET_GAP_MS,
  MODE2_REVEAL_WORD_MS,
} from '@sketch-catch/shared';

// 발표 1건의 진행 단계 — wait(테두리 이동 대기) → lead(앞말) → word(단어 공개) → draw(스케치 재생) → hold(여운)
export type RevealPhase = 'wait' | 'lead' | 'word' | 'draw' | 'hold';

export type RevealEntryTiming = { phase: RevealPhase; progress: number };

// 말풍선 글자는 구간의 앞 70% 동안 타이핑되고 나머지는 멈춰서 읽을 시간을 준다
const TYPING_RATIO = 0.7;

const SEGMENTS: ReadonlyArray<{ phase: Exclude<RevealPhase, 'wait'>; ms: number }> = [
  { phase: 'lead', ms: MODE2_REVEAL_LEAD_MS },
  { phase: 'word', ms: MODE2_REVEAL_WORD_MS },
  { phase: 'draw', ms: MODE2_REVEAL_DRAW_MS },
  { phase: 'hold', ms: MODE2_REVEAL_HOLD_MS },
];

export function getEntryTiming(elapsedMs: number): RevealEntryTiming {
  if (elapsedMs < 0) return { phase: 'wait', progress: 0 };
  let start = 0;
  for (const segment of SEGMENTS) {
    if (elapsedMs < start + segment.ms) return { phase: segment.phase, progress: (elapsedMs - start) / segment.ms };
    start += segment.ms;
  }
  return { phase: 'hold', progress: 1 };
}

// 다시 보기(기기 단독 재생) 위치 — 실시간 공개식과 같게 테두리 이동 대기 후 발표를 차례로 이어 간다
export function getReplayPosition(elapsedMs: number, entryCount: number): { entryIndex: number; entryElapsed: number } {
  const t = elapsedMs - MODE2_REVEAL_SHEET_GAP_MS;
  if (t < 0 || entryCount === 0) return { entryIndex: 0, entryElapsed: t };
  const entryIndex = Math.min(entryCount - 1, Math.floor(t / MODE2_REVEAL_ENTRY_MS));
  return { entryIndex, entryElapsed: t - entryIndex * MODE2_REVEAL_ENTRY_MS };
}

export function getReplayDurationMs(entryCount: number): number {
  return MODE2_REVEAL_SHEET_GAP_MS + MODE2_REVEAL_ENTRY_MS * entryCount;
}

// 한글 음절도 1글자씩 끊기도록 코드 포인트 단위로 자른다
export function typeText(full: string, progress: number): string {
  const chars = Array.from(full);
  const count = Math.ceil(chars.length * Math.min(1, Math.max(0, progress) / TYPING_RATIO));
  return chars.slice(0, count).join('');
}
