import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MODE2_REVEAL_GUESS_LEAD,
  MODE2_REVEAL_TOP_LEAD,
  buildRevealEntries,
  getRevealPosition,
  getSheetRevealDurationMs,
  getStrokeTimeline,
  sliceStrokesAt,
  type Mode2ReviewState,
  type Mode2RevealEntry,
  type RevealPhase,
  type Stroke,
} from '@sketch-catch/shared';
import { typeText } from './revealTimeline';

const UNKNOWN_WORD = '???';
// 스케치 재생 중 화면 갱신 간격 — 30fps면 손으로 그리는 느낌으로 충분하다
const FRAME_INTERVAL_MS = 33;
const NO_STROKES: Stroke[] = [];

export type RevealGuesserScene = { authorId: string; text: string; icon: 'question' | 'bulb' };

export type RevealScene = {
  entryIndex: number;
  painterId: string | null;
  painterText: string;
  strokes: Stroke[];
  guesser: RevealGuesserScene | null;
  phase: RevealPhase;
};

// 재생할 시트 1장과 그 시트가 시작된 기기 시각 (-Infinity면 완성 장면에 멈춘다)
export type RevealSheetPlayback = { sheetIndex: number; startedAt: number };

function wordOf(entry: Mode2RevealEntry | undefined): string {
  return `${entry?.text || UNKNOWN_WORD}!`;
}

function playStrokes(entry: Mode2RevealEntry | undefined, progress: number): Stroke[] {
  if (!entry) return NO_STROKES;
  return sliceStrokesAt(entry.strokes, getStrokeTimeline(entry.strokes), progress);
}

// 상단: 지금 그린 사람이 "내가 그린 그림은.. {단어}!" → 그림 재생 → 하단: 다음 사람이 "이 그림은.. {정답}!" → 다음 사람이 상단으로
function buildScene(entries: Mode2RevealEntry[], sheetElapsedMs: number): RevealScene {
  const { entryIndex, phase, progress } = getRevealPosition(sheetElapsedMs, entries.length);
  const entry = entries[entryIndex];
  const next = entries[entryIndex + 1];
  const painterFull = `${MODE2_REVEAL_TOP_LEAD} ${wordOf(entry)}`;
  const base = { entryIndex, painterId: entry?.authorId ?? null, phase };

  if (phase === 'wait') return { ...base, painterText: '', strokes: NO_STROKES, guesser: null };
  // 원조자만 앞말을 타이핑하고, 하단에서 올라온 사람은 방금 말한 정답을 그대로 들고 온다
  const painterText = phase === 'lead' && entryIndex === 0 ? typeText(painterFull, progress) : painterFull;
  if (phase === 'lead') return { ...base, painterText, strokes: NO_STROKES, guesser: null };
  if (phase === 'draw') return { ...base, painterText, strokes: playStrokes(entry, progress), guesser: null };

  const guessText = typeText(`${MODE2_REVEAL_GUESS_LEAD} ${wordOf(next)}`, progress);
  const icon = Array.from(guessText).length <= Array.from(MODE2_REVEAL_GUESS_LEAD).length ? 'question' : 'bulb';
  return {
    ...base,
    painterText,
    strokes: entry?.strokes ?? NO_STROKES,
    guesser: next ? { authorId: next.authorId, text: guessText, icon } : null,
  };
}

/**
 * 시트 1장의 장면 — 재생 중에만 시계를 돌린다. 화면 전체가 아니라 재생 영역 컴포넌트에서만 호출해
 * 30fps 갱신이 채팅 입력 등 다른 UI를 다시 그리지 않게 한다.
 */
export function useRevealScene(entries: Mode2RevealEntry[], startedAt: number): RevealScene {
  const endsAt = startedAt + getSheetRevealDurationMs(entries.length);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    setNow(Date.now());
    if (Date.now() >= endsAt) return undefined;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) clearInterval(timer);
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [endsAt]);

  return buildScene(entries, now - startedAt);
}

// 실시간 공개식(서버가 시트 단위로 진행)과 종료 후 다시 보기(기기 단독 재생) 중 지금 보여 줄 시트를 고른다
export function useRevealPlayback(review: Mode2ReviewState | null, liveSheetStartAt: number | null) {
  const [replay, setReplay] = useState<RevealSheetPlayback | null>(null);
  const sheets = useMemo(() => review?.sheets ?? [], [review?.sheets]);
  const entriesBySheet = useMemo(
    () => sheets.map(sheet => buildRevealEntries(sheet.steps.map(step => step.content))),
    [sheets],
  );

  const live = review?.live ?? null;
  const isLive = live !== null;
  const isFinished = review !== null && !isLive;
  // 실시간 진행이 다시 시작되면(재입장 등) 다시 보기는 접는다
  useEffect(() => {
    if (isLive) setReplay(null);
  }, [isLive]);

  const playback = ((): RevealSheetPlayback | null => {
    if (sheets.length === 0) return null;
    if (live) return { sheetIndex: live.sheetIndex, startedAt: liveSheetStartAt ?? Number.NEGATIVE_INFINITY };
    if (replay) return replay;
    // 실시간 발표가 끝난 직후 — 마지막 시트의 완성 장면을 유지한다
    return { sheetIndex: sheets.length - 1, startedAt: Number.NEGATIVE_INFINITY };
  })();

  const startReplay = useCallback(
    (sheetIndex: number): void => {
      if (!isFinished) return;
      setReplay({ sheetIndex, startedAt: Date.now() });
    },
    [isFinished],
  );

  return { playback, entriesBySheet, isLive, isFinished, startReplay };
}
