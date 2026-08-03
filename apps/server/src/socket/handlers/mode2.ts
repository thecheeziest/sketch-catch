import type { Namespace } from 'socket.io';
import type {
  ClientEvents,
  ServerEvents,
  Player,
  RoomState,
  RoomStatus,
  Mode2Phase,
  Mode2StepContent,
  Mode2Step,
  Stroke,
} from '@sketch-catch/shared';
import { SERVER_EVENT } from '@sketch-catch/shared';
import { getRoomState, saveRoomState } from '../../services/rooms.service.js';
import { startMode2Review } from './mode2-review.js';
import { endGame } from './game.js';

type GameNamespace = Namespace<ClientEvents, ServerEvents>;
type Mode2Socket = { data: { userId: string }; rooms: Set<string> };

// 시트 1장의 진행 상태 — sheetId = 1단계(PROMPT) 작성자(원조자) userId
export type Mode2Sheet = {
  sheetId: string;
  ownerIndex: number; // 슬롯 정렬된 players 배열 내 원조자 인덱스
  steps: Mode2StepContent[];
};

// RoomState.current에 저장되는 모드2 진행 상태 (RoomState는 JSON 직렬화라 Set 대신 배열 사용)
export type Mode2Current = {
  step: number; // 0-indexed. 0=PROMPT, 홀수=DRAW, 짝수(0제외)=ANSWER
  phase: Mode2Phase;
  sheets: Mode2Sheet[];
  submitted: string[]; // 이번 step 제출 완료된 sheetId 배열
  startedAt: number;
};

// PROMPT 단계는 고정 20초 (UI-SPEC). DRAW/ANSWER는 RoomConfig 값 사용.
const PROMPT_DURATION_SEC = 20;

// 클라이언트 입력 절대 신뢰 금지 — mobile MAX_TEXT_LENGTH(mode2.tsx)와 동일한 상한
const MAX_TEXT_LENGTH = 40;
// strokes는 RoomState에 영구 저장되고 GIF 렌더링 입력으로도 쓰이므로 상한 없이는 저장 폭증/렌더링 DoS 위험
const MAX_STROKES = 300;
const MAX_POINTS_PER_STROKE = 2000;

export const mode2Timers = new Map<string, ReturnType<typeof setTimeout>>();

export function currentAssignee(players: Player[], ownerIndex: number, step: number): Player {
  const n = players.length;
  return players[(ownerIndex + step) % n]!;
}

export function phaseForStep(step: number): Mode2Phase {
  if (step === 0) return 'PROMPT';
  return step % 2 === 1 ? 'DRAW' : 'ANSWER';
}

function statusForPhase(phase: Mode2Phase): RoomStatus {
  if (phase === 'PROMPT') return 'MODE2_PROMPT_PHASE';
  if (phase === 'DRAW') return 'MODE2_DRAW_PHASE';
  return 'MODE2_ANSWER_PHASE';
}

function durationForPhase(phase: Mode2Phase, config: RoomState['config']): number {
  if (phase === 'PROMPT') return PROMPT_DURATION_SEC;
  if (phase === 'DRAW') return config.drawTimer;
  return config.answerTimer;
}

export function isMode2Active(status: RoomStatus): boolean {
  return status === 'MODE2_PROMPT_PHASE' || status === 'MODE2_DRAW_PHASE' || status === 'MODE2_ANSWER_PHASE';
}

export function sortedPlayers(state: RoomState): Player[] {
  return [...state.players].sort((a, b) => a.slot - b.slot);
}

function emptyContent(phase: Mode2Phase, authorId: string): Mode2StepContent {
  if (phase === 'DRAW') return { kind: 'DRAW', authorId, strokes: [] };
  if (phase === 'PROMPT') return { kind: 'PROMPT', authorId, text: '' };
  return { kind: 'ANSWER', authorId, text: '' };
}

function toPreviousContent(content: Mode2StepContent | undefined): Mode2Step['previousContent'] {
  if (!content) return undefined;
  if (content.kind === 'DRAW') return { kind: 'DRAW', strokes: content.strokes };
  return { kind: 'TEXT', text: content.text };
}

function emitSteps(game: GameNamespace, code: string, state: RoomState, current: Mode2Current): void {
  const players = sortedPlayers(state);
  const roomName = `room:${code}`;
  for (const sheet of current.sheets) {
    const assignee = currentAssignee(players, sheet.ownerIndex, current.step);
    const previousContent = toPreviousContent(sheet.steps[sheet.steps.length - 1]);
    const payload: Mode2Step = {
      sheetId: sheet.sheetId,
      stepIndex: current.step,
      phase: current.phase,
      assigneeId: assignee.id,
      previousContent,
      durationSec: durationForPhase(current.phase, state.config),
      totalSteps: players.length,
    };
    game.to(roomName).emit('mode2:step', payload);
  }
}

function scheduleStepTimeout(game: GameNamespace, code: string, durationSec: number): void {
  clearTimeout(mode2Timers.get(code));
  mode2Timers.set(
    code,
    setTimeout(() => void advanceStep(game, code), durationSec * 1000),
  );
}

export async function startMode2(game: GameNamespace, code: string): Promise<void> {
  const state = await getRoomState(code);
  if (!state) return;

  const players = sortedPlayers(state);
  const sheets: Mode2Sheet[] = players.map((p, i) => ({ sheetId: p.id, ownerIndex: i, steps: [] }));

  const current: Mode2Current = {
    step: 0,
    phase: 'PROMPT',
    sheets,
    submitted: [],
    startedAt: Date.now(),
  };

  state.status = 'MODE2_PROMPT_PHASE';
  state.current = current;
  await saveRoomState(state);
  game.to(`room:${code}`).emit(SERVER_EVENT.ROOM_STATE, state);

  emitSteps(game, code, state, current);
  scheduleStepTimeout(game, code, durationForPhase('PROMPT', state.config));
}

async function assertAssignee(
  code: string,
  socket: Mode2Socket,
  sheetId: string,
): Promise<{ state: RoomState; current: Mode2Current; sheet: Mode2Sheet } | null> {
  const state = await getRoomState(code);
  if (!state || !isMode2Active(state.status)) return null;

  const current = state.current as Mode2Current;
  const sheet = current.sheets.find((s) => s.sheetId === sheetId);
  if (!sheet) return null;
  if (current.submitted.includes(sheetId)) return null; // 중복 제출 방지

  const players = sortedPlayers(state);
  const assignee = currentAssignee(players, sheet.ownerIndex, current.step);
  // 담당자가 아닌 유저의 제출은 조용히 거부 — 서버가 진실의 출처
  if (assignee.id !== socket.data.userId) return null;

  return { state, current, sheet };
}

function sanitizeText(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, MAX_TEXT_LENGTH);
}

function sanitizeStrokes(strokes: unknown, authorId: string): Stroke[] {
  if (!Array.isArray(strokes)) return [];
  const clean: Stroke[] = [];
  for (const s of strokes.slice(0, MAX_STROKES)) {
    if (typeof s !== 'object' || s === null) continue;
    const stroke = s as Partial<Stroke>;
    if (typeof stroke.id !== 'string' || typeof stroke.color !== 'string') continue;
    if (typeof stroke.width !== 'number' || typeof stroke.startTime !== 'number') continue;
    if (!Array.isArray(stroke.points)) continue;
    const points = stroke.points
      .slice(0, MAX_POINTS_PER_STROKE)
      .filter(
        (p): p is Stroke['points'][number] =>
          typeof p === 'object' &&
          p !== null &&
          typeof (p as { x?: unknown }).x === 'number' &&
          typeof (p as { y?: unknown }).y === 'number' &&
          typeof (p as { t?: unknown }).t === 'number',
      );
    // authorId는 클라이언트 값을 신뢰하지 않고 서버가 검증한 assignee로 강제
    clean.push({ id: stroke.id, authorId, color: stroke.color, width: stroke.width, points, startTime: stroke.startTime });
  }
  return clean;
}

function findRoomCode(socket: Mode2Socket): string | null {
  const roomName = Array.from(socket.rooms).find((r) => r.startsWith('room:'));
  return roomName ? roomName.replace('room:', '') : null;
}

async function checkAllSubmitted(
  game: GameNamespace,
  code: string,
  current: Mode2Current,
): Promise<void> {
  if (current.submitted.length >= current.sheets.length) {
    await advanceStep(game, code);
  }
}

export async function handleMode2Prompt(
  game: GameNamespace,
  socket: Mode2Socket,
  payload: { sheetId: string; text: string },
): Promise<void> {
  const code = findRoomCode(socket);
  if (!code) return;
  const ctx = await assertAssignee(code, socket, payload.sheetId);
  if (!ctx) return;

  ctx.sheet.steps.push({ kind: 'PROMPT', authorId: socket.data.userId, text: sanitizeText(payload.text) });
  ctx.current.submitted.push(payload.sheetId);
  await saveRoomState(ctx.state);
  await checkAllSubmitted(game, code, ctx.current);
}

export async function handleMode2Answer(
  game: GameNamespace,
  socket: Mode2Socket,
  payload: { sheetId: string; text: string },
): Promise<void> {
  const code = findRoomCode(socket);
  if (!code) return;
  const ctx = await assertAssignee(code, socket, payload.sheetId);
  if (!ctx) return;

  ctx.sheet.steps.push({ kind: 'ANSWER', authorId: socket.data.userId, text: sanitizeText(payload.text) });
  ctx.current.submitted.push(payload.sheetId);
  await saveRoomState(ctx.state);
  await checkAllSubmitted(game, code, ctx.current);
}

export async function handleMode2DrawDone(
  game: GameNamespace,
  socket: Mode2Socket,
  payload: { sheetId: string; strokes: Stroke[] },
): Promise<void> {
  const code = findRoomCode(socket);
  if (!code) return;
  const ctx = await assertAssignee(code, socket, payload.sheetId);
  if (!ctx) return;

  ctx.sheet.steps.push({
    kind: 'DRAW',
    authorId: socket.data.userId,
    strokes: sanitizeStrokes(payload.strokes, socket.data.userId),
  });
  ctx.current.submitted.push(payload.sheetId);
  await saveRoomState(ctx.state);
  await checkAllSubmitted(game, code, ctx.current);
}

export async function advanceStep(game: GameNamespace, code: string): Promise<void> {
  clearTimeout(mode2Timers.get(code));
  mode2Timers.delete(code);

  const state = await getRoomState(code);
  if (!state || !isMode2Active(state.status)) return;

  const current = state.current as Mode2Current;
  const players = sortedPlayers(state);

  // D-08: 미제출 시트는 빈 콘텐츠로 강제 다음 단계 전환
  for (const sheet of current.sheets) {
    if (current.submitted.includes(sheet.sheetId)) continue;
    const assignee = currentAssignee(players, sheet.ownerIndex, current.step);
    sheet.steps.push(emptyContent(current.phase, assignee.id));
  }

  const nextStep = current.step + 1;
  current.submitted = [];

  if (nextStep >= current.sheets.length) {
    // 원조자에게 시트 복귀 — 리뷰 단계로 전환
    current.step = nextStep;
    state.status = 'MODE2_REVIEW';
    state.current = current;
    await saveRoomState(state);
    game.to(`room:${code}`).emit(SERVER_EVENT.ROOM_STATE, state);
    await startMode2Review(game, code);
    return;
  }

  current.step = nextStep;
  current.phase = phaseForStep(nextStep);
  state.status = statusForPhase(current.phase);
  state.current = current;
  await saveRoomState(state);

  emitSteps(game, code, state, current);
  scheduleStepTimeout(game, code, durationForPhase(current.phase, state.config));
}

// OFFL-05/D-08: 모드2 전용 이탈 처리 — mode1의 handlePlayerLeft와는 별도 함수로 유지
export async function handleMode2PlayerLeft(
  game: GameNamespace,
  code: string,
  userId: string,
): Promise<void> {
  const state = await getRoomState(code);
  if (!state) return;

  const player = state.players.find((p) => p.id === userId);
  if (!player || player.left) return; // 이미 처리됨

  player.connected = false;
  player.left = true;

  const activePlayers = state.players.filter((p) => !p.left);

  // 3명 미만이면 게임 즉시 종료 (D-03과 동일 임계값)
  if (activePlayers.length < 3) {
    await saveRoomState(state);
    game.to(`room:${code}`).emit(SERVER_EVENT.ROOM_STATE, state);
    await endGame(game, code, 'INSUFFICIENT_PLAYERS');
    return;
  }

  await saveRoomState(state);
  game.to(`room:${code}`).emit(SERVER_EVENT.ROOM_STATE, state);

  // D-07: REVIEW 단계는 force-submit 대상 아님 (isMode2Active=false) — left 마킹만 하고 종료
  if (!isMode2Active(state.status)) return;

  const current = state.current as Mode2Current;
  const players = sortedPlayers(state);
  for (const sheet of current.sheets) {
    if (current.submitted.includes(sheet.sheetId)) continue;
    const assignee = currentAssignee(players, sheet.ownerIndex, current.step);
    if (assignee.id !== userId) continue;
    sheet.steps.push(emptyContent(current.phase, assignee.id));
    current.submitted.push(sheet.sheetId);
  }
  await saveRoomState(state);
  await checkAllSubmitted(game, code, current);
}
