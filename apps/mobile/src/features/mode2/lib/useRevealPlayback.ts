import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildRevealEntries,
  getStrokeTimeline,
  sliceStrokesAt,
  type Mode2ReviewState,
  type Mode2RevealEntry,
  type Stroke,
} from '@sketch-catch/shared';
import { getEntryTiming, getReplayDurationMs, getReplayPosition, typeText, type RevealPhase } from './revealTimeline';

export const LEAD_OWNER = '내가 그릴 그림은..';
export const LEAD_GUESSER = '이 그림은 아마..';
const UNKNOWN_WORD = '???';
// 스케치 재생 중 화면 갱신 간격 — 30fps면 손으로 그리는 느낌으로 충분하다
const FRAME_INTERVAL_MS = 33;

export type RevealGuesserScene = { authorId: string; text: string; icon: 'question' | 'bulb' };

export type RevealScene = {
  sheetIndex: number;
  ownerId: string | null;
  ownerText: string;
  strokes: Stroke[];
  guesser: RevealGuesserScene | null;
  phase: RevealPhase;
};

// active 동안 현재 시각을 갱신한다 (끝나면 멈춰 배터리를 아낀다).
// rAF는 120Hz 기기에서 초당 120번 깨어나 걸러내야 하므로, 필요한 간격으로만 깨우는 interval을 쓴다
function useClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), FRAME_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function wordOf(entry: Mode2RevealEntry | undefined): string {
  return `${entry?.text || UNKNOWN_WORD}!`;
}

function playStrokes(entry: Mode2RevealEntry | undefined, progress: number): Stroke[] {
  if (!entry) return [];
  return sliceStrokesAt(entry.strokes, getStrokeTimeline(entry.strokes), progress);
}

function buildScene(
  sheetIndex: number,
  ownerId: string | null,
  entries: Mode2RevealEntry[],
  entryIndex: number,
  elapsedMs: number,
): RevealScene {
  const { phase, progress } = getEntryTiming(elapsedMs);
  const entry = entries[entryIndex];
  const ownerFull = `${LEAD_OWNER} ${wordOf(entries[0])}`;

  if (entryIndex === 0) {
    const ownerText = (() => {
      if (phase === 'wait') return '';
      if (phase === 'lead') return typeText(LEAD_OWNER, progress);
      if (phase === 'word') return `${LEAD_OWNER} ${typeText(wordOf(entry), progress)}`;
      return ownerFull;
    })();
    const strokes = (() => {
      if (phase === 'draw') return playStrokes(entry, progress);
      if (phase === 'hold') return entry?.strokes ?? [];
      return [];
    })();
    return { sheetIndex, ownerId, ownerText, strokes, guesser: null, phase };
  }

  // 맞히는 사람은 직전 그림을 보며 추측하고, 단어가 다 나온 뒤 자기 그림을 처음부터 그려 보인다
  const previous = entries[entryIndex - 1];
  const strokes = (() => {
    if (phase === 'draw') return playStrokes(entry, progress);
    if (phase === 'hold') return entry?.strokes ?? [];
    return previous?.strokes ?? [];
  })();
  const guesserText = (() => {
    if (phase === 'lead' || phase === 'wait') return typeText(LEAD_GUESSER, phase === 'wait' ? 0 : progress);
    if (phase === 'word') return `${LEAD_GUESSER} ${typeText(wordOf(entry), progress)}`;
    return `${LEAD_GUESSER} ${wordOf(entry)}`;
  })();
  const icon = phase === 'lead' || phase === 'wait' ? 'question' : 'bulb';
  return {
    sheetIndex,
    ownerId,
    ownerText: ownerFull,
    strokes,
    guesser: entry ? { authorId: entry.authorId, text: guesserText, icon } : null,
    phase,
  };
}

type Replay = { sheetIndex: number; startedAt: number };

// 실시간 공개식(서버 진행)과 종료 후 다시 보기(기기 단독 재생)를 같은 장면 계산으로 그린다
export function useRevealPlayback(review: Mode2ReviewState | null, liveEntryStartAt: number | null) {
  const [replay, setReplay] = useState<Replay | null>(null);
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

  const replayEntries = replay ? (entriesBySheet[replay.sheetIndex] ?? []) : [];
  const [replayClockActive, setReplayClockActive] = useState(false);
  const now = useClock(isLive || replayClockActive);

  useEffect(() => {
    if (!replay) {
      setReplayClockActive(false);
      return;
    }
    setReplayClockActive(true);
    const remaining = replay.startedAt + getReplayDurationMs(replayEntries.length) - Date.now();
    const timer = setTimeout(() => setReplayClockActive(false), Math.max(0, remaining) + 100);
    return () => clearTimeout(timer);
  }, [replay, replayEntries.length]);

  const scene = ((): RevealScene | null => {
    if (sheets.length === 0) return null;
    if (live) {
      const entries = entriesBySheet[live.sheetIndex] ?? [];
      const ownerId = sheets[live.sheetIndex]?.ownerId ?? null;
      return buildScene(live.sheetIndex, ownerId, entries, live.entryIndex, now - (liveEntryStartAt ?? now));
    }
    if (replay) {
      const position = getReplayPosition(now - replay.startedAt, replayEntries.length);
      const ownerId = sheets[replay.sheetIndex]?.ownerId ?? null;
      return buildScene(replay.sheetIndex, ownerId, replayEntries, position.entryIndex, position.entryElapsed);
    }
    // 실시간 발표가 끝난 직후 — 마지막 시트의 완성 장면을 유지한다
    const lastIndex = sheets.length - 1;
    const entries = entriesBySheet[lastIndex] ?? [];
    return buildScene(
      lastIndex,
      sheets[lastIndex]?.ownerId ?? null,
      entries,
      Math.max(0, entries.length - 1),
      Number.POSITIVE_INFINITY,
    );
  })();

  const startReplay = useCallback(
    (sheetIndex: number): void => {
      if (!isFinished) return;
      setReplay({ sheetIndex, startedAt: Date.now() });
    },
    [isFinished],
  );

  return { scene, isLive, isFinished, startReplay };
}
