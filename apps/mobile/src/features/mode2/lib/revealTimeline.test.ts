import { describe, expect, it } from 'vitest';
import {
  MODE2_REVEAL_DRAW_MS,
  MODE2_REVEAL_ENTRY_MS,
  MODE2_REVEAL_LEAD_MS,
  MODE2_REVEAL_SHEET_GAP_MS,
  MODE2_REVEAL_WORD_MS,
} from '@sketch-catch/shared';
import { getEntryTiming, getReplayDurationMs, getReplayPosition, typeText } from './revealTimeline';

describe('정답 공개식 타임라인', () => {
  it('발표 1건은 앞말 → 단어 → 스케치 재생 → 여운 순서로 진행된다', () => {
    expect(getEntryTiming(-1)).toEqual({ phase: 'wait', progress: 0 });
    expect(getEntryTiming(0)).toEqual({ phase: 'lead', progress: 0 });
    expect(getEntryTiming(MODE2_REVEAL_LEAD_MS).phase).toBe('word');
    expect(getEntryTiming(MODE2_REVEAL_LEAD_MS + MODE2_REVEAL_WORD_MS + MODE2_REVEAL_DRAW_MS / 2)).toEqual({
      phase: 'draw',
      progress: 0.5,
    });
    expect(getEntryTiming(MODE2_REVEAL_ENTRY_MS + 10_000)).toEqual({ phase: 'hold', progress: 1 });
  });

  it('다시 보기는 테두리 이동 대기 후 발표를 차례로 이어 가고 마지막 발표에서 멈춘다', () => {
    expect(getReplayPosition(0, 4)).toEqual({ entryIndex: 0, entryElapsed: -MODE2_REVEAL_SHEET_GAP_MS });
    expect(getReplayPosition(MODE2_REVEAL_SHEET_GAP_MS + MODE2_REVEAL_ENTRY_MS + 5, 4)).toEqual({
      entryIndex: 1,
      entryElapsed: 5,
    });
    expect(getReplayPosition(getReplayDurationMs(4) + 1000, 4).entryIndex).toBe(3);
  });

  it('타이핑은 한글 음절 단위로 끊고 구간 70%에서 완성된다', () => {
    expect(typeText('고양이!', 0)).toBe('');
    expect(typeText('고양이!', 0.35)).toBe('고양');
    expect(typeText('고양이!', 0.7)).toBe('고양이!');
  });
});
