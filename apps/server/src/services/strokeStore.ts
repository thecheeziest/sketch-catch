import type { StrokeEvent } from '@sketch-catch/shared';

// 모드1 현재 라운드의 그림 — 재접속한 유저에게 끊겨 있던 동안 그려진 그림을 다시 보내는 용도.
// 라운드가 바뀌면 비우고, 게임 종료·방 삭제 시 정리한다. 서버 메모리에만 둔다 (서버 재시작 시 유실 허용).
// drawn: 지우기와 상관없이 이번 라운드에 한 번이라도 그렸는지 (코인 정산의 '그리지 않음' 판정용)
type RoundStrokes = { roundKey: string; strokes: StrokeEvent[]; pointCount: number; drawn: boolean };

// 한 라운드에 보관할 최대 좌표 수 — 비정상적으로 많은 입력이 메모리를 잡아먹지 않도록 넘으면 기록만 멈춘다
const MAX_POINTS_PER_ROUND = 50_000;
const store = new Map<string, RoundStrokes>();

// 같은 게임·같은 라운드인지 구분하는 키
export function strokeRoundKey(gameId: string | undefined, roundIndex: number): string {
  return `${gameId ?? ''}:${roundIndex}`;
}

function roundOf(code: string, roundKey: string): RoundStrokes {
  const existing = store.get(code);
  if (existing?.roundKey === roundKey) return existing;
  const fresh: RoundStrokes = { roundKey, strokes: [], pointCount: 0, drawn: false };
  store.set(code, fresh);
  return fresh;
}

export function recordStroke(code: string, roundKey: string, event: StrokeEvent): void {
  const round = roundOf(code, roundKey);

  if (event.strokeId === '__clear__') {
    round.strokes = [];
    round.pointCount = 0;
    return;
  }
  if (event.strokeId === '__undo__') {
    const removed = round.strokes.pop();
    round.pointCount -= removed?.points?.length ?? 0;
    return;
  }

  round.drawn = true;

  // append 좌표는 클라이언트 입력 그대로라 배열이 아닐 수 있다
  const points = Array.isArray(event.points) ? event.points : [];
  if (round.pointCount + points.length > MAX_POINTS_PER_ROUND) return;
  round.pointCount += points.length;

  const existing = round.strokes.find(s => s.strokeId === event.strokeId);
  if (!existing) {
    round.strokes.push({ ...event, points: [...points] });
    return;
  }
  if (points.length > 0) existing.points = [...(existing.points ?? []), ...points];
  if (event.ended !== undefined) existing.ended = event.ended;
}

export function getRoundStrokes(code: string, roundKey: string): StrokeEvent[] {
  const round = store.get(code);
  return round?.roundKey === roundKey ? round.strokes : [];
}

export function hasRoundDrawing(code: string, roundKey: string): boolean {
  const round = store.get(code);
  return round?.roundKey === roundKey && round.drawn;
}

export function clearRoomStrokes(code: string): void {
  store.delete(code);
}
