import { describe, expect, it } from 'vitest';
import {
  MODE2_REVEAL_DRAW_MS,
  MODE2_REVEAL_GUESS_MS,
  MODE2_REVEAL_MOVE_MS,
  MODE2_REVEAL_OWNER_LEAD_MS,
  MODE2_REVEAL_SHEET_GAP_MS,
  getRevealPosition,
  getSheetRevealDurationMs,
} from '@sketch-catch/shared';
import { typeText } from './revealTimeline';

const OWNER_ENTRY_MS = MODE2_REVEAL_OWNER_LEAD_MS + MODE2_REVEAL_DRAW_MS + MODE2_REVEAL_GUESS_MS;

describe('정답 공개식 타임라인', () => {
  it('원조자는 앞말 → 그림 재생 → 다음 사람 정답 순서로, 그림이 끝나자마자 정답 단계로 넘어간다', () => {
    expect(getRevealPosition(0, 3)).toEqual({ entryIndex: 0, phase: 'wait', progress: 0 });
    expect(getRevealPosition(MODE2_REVEAL_SHEET_GAP_MS, 3)).toEqual({ entryIndex: 0, phase: 'lead', progress: 0 });
    const drawStart = MODE2_REVEAL_SHEET_GAP_MS + MODE2_REVEAL_OWNER_LEAD_MS;
    expect(getRevealPosition(drawStart + MODE2_REVEAL_DRAW_MS / 2, 3)).toEqual({
      entryIndex: 0,
      phase: 'draw',
      progress: 0.5,
    });
    expect(getRevealPosition(drawStart + MODE2_REVEAL_DRAW_MS, 3)).toEqual({
      entryIndex: 0,
      phase: 'guess',
      progress: 0,
    });
  });

  it('맞힌 사람은 상단으로 올라온 뒤 짧은 대기만 하고 바로 그린다', () => {
    const secondStart = MODE2_REVEAL_SHEET_GAP_MS + OWNER_ENTRY_MS;
    expect(getRevealPosition(secondStart, 3)).toEqual({ entryIndex: 1, phase: 'lead', progress: 0 });
    expect(getRevealPosition(secondStart + MODE2_REVEAL_MOVE_MS, 3)).toEqual({
      entryIndex: 1,
      phase: 'draw',
      progress: 0,
    });
  });

  it('시트 길이는 테두리 이동 + 발표 합이고, 끝을 넘기면 마지막 발표 완성 장면에 머문다', () => {
    const entryMs = MODE2_REVEAL_MOVE_MS + MODE2_REVEAL_DRAW_MS + MODE2_REVEAL_GUESS_MS;
    expect(getSheetRevealDurationMs(3)).toBe(MODE2_REVEAL_SHEET_GAP_MS + OWNER_ENTRY_MS + entryMs * 2);
    expect(getRevealPosition(getSheetRevealDurationMs(3) + 1000, 3)).toEqual({
      entryIndex: 2,
      phase: 'guess',
      progress: 1,
    });
    expect(getRevealPosition(Number.POSITIVE_INFINITY, 3)).toEqual({ entryIndex: 2, phase: 'guess', progress: 1 });
  });

  it('타이핑은 한글 음절 단위로 끊고 구간 70%에서 완성된다', () => {
    expect(typeText('고양이!', 0)).toBe('');
    expect(typeText('고양이!', 0.35)).toBe('고양');
    expect(typeText('고양이!', 0.7)).toBe('고양이!');
  });
});
