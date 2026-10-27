import type { Namespace, Socket } from 'socket.io';
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
import {
  MODE2_ANSWER_CUE_MS,
  MODE2_ANSWER_SEC,
  MODE2_DRAW_CUE_MS,
  MODE2_DRAW_SEC,
  MODE2_PLAYER_MIN,
  MODE2_PROMPT_SEC,
  MODE2_SUBMIT_GRACE_MS,
  paintSpansSchema,
  SERVER_EVENT,
  type Category,
} from '@sketch-catch/shared';
import { getRoomState, saveRoomState } from '../../services/rooms.service.js';
import { pickRoundWord } from '../../services/word.service.js';
import { clearRoomTimer, setRoomTimer } from '../../services/roomTimers.js';
import { recordMode2Submit } from '../../services/coin.service.js';
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

// 담당자가 작성 중인 내용 — 시간 초과 시 빈 칸 대신 이 값으로 자동 제출한다
export type Mode2Draft = { text?: string; strokes?: Stroke[] };

// RoomState.current에 저장되는 모드2 진행 상태 (RoomState는 JSON 직렬화라 Set 대신 배열 사용)
export type Mode2Current = {
  step: number; // 0-indexed. 0=PROMPT, 이후 DRAW/ANSWER 교대
  phase: Mode2Phase;
  sheets: Mode2Sheet[];
  submitted: string[]; // 이번 step 제출 완료된 sheetId 배열
  drafts: Record<string, Mode2Draft>; // sheetId → 이번 step 작성 중 내용
  startedAt: number; // 이번 step 시작 시각
};

// 제시어를 끝내 입력하지 않았을 때 단어 풀도 비어 있으면 쓰는 대체 제시어
const FALLBACK_PROMPT = '자유 그림';

// 클라이언트 입력 절대 신뢰 금지 — mobile MAX_TEXT_LENGTH(mode2.tsx)와 동일한 상한
const MAX_TEXT_LENGTH = 40;
// strokes는 RoomState에 영구 저장되고 GIF 렌더링 입력으로도 쓰이므로 상한 없이는 저장 폭증/렌더링 DoS 위험
const MAX_STROKES = 300;
const MAX_POINTS_PER_STROKE = 2000;

// 시트는 [제시어(원조자), 그림(원조자), 정답(다음 사람), 그림(다음 사람), ...] 순서로 돈다.
// 인원과 관계없이 한 사람이 (글, 그림) 2단계를 연달아 맡으므로 담당자 오프셋은 step / 2.
export function currentAssignee(players: Player[], ownerIndex: number, step: number): Player {
  return players[(ownerIndex + Math.floor(step / 2)) % players.length]!;
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

function durationSecForPhase(phase: Mode2Phase): number {
  if (phase === 'PROMPT') return MODE2_PROMPT_SEC;
  if (phase === 'DRAW') return MODE2_DRAW_SEC;
  return MODE2_ANSWER_SEC;
}

// DRAW·ANSWER는 '그려 주세요' / '그림을 맞혀주세요' 안내가 끝난 뒤부터 제한 시간이 흐른다
function cueMsForPhase(phase: Mode2Phase): number {
  if (phase === 'DRAW') return MODE2_DRAW_CUE_MS;
  if (phase === 'ANSWER') return MODE2_ANSWER_CUE_MS;
  return 0;
}

function stepDurationMs(phase: Mode2Phase): number {
  return cueMsForPhase(phase) + durationSecForPhase(phase) * 1000;
}

export function isMode2Active(status: RoomStatus): boolean {
  return status === 'MODE2_PROMPT_PHASE' || status === 'MODE2_DRAW_PHASE' || status === 'MODE2_ANSWER_PHASE';
}

export function sortedPlayers(state: RoomState): Player[] {
  return [...state.players].sort((a, b) => a.slot - b.slot);
}

// 마지막 사람의 그림까지 진행 — 시트마다 2N개의 콘텐츠가 쌓인다
export function finalStepForPlayerCount(playerCount: number): number {
  return playerCount * 2 - 1;
}

function toPreviousContent(content: Mode2StepContent | undefined): Mode2Step['previousContent'] {
  if (!content) return undefined;
  if (content.kind === 'DRAW') return { kind: 'DRAW', strokes: content.strokes };
  return { kind: 'TEXT', text: content.text };
}

function buildStepPayloads(state: RoomState, current: Mode2Current): Mode2Step[] {
  const players = sortedPlayers(state);
  const totalSteps = finalStepForPlayerCount(players.length) + 1;
  const elapsedMs = Date.now() - current.startedAt;
  const remainingMs = Math.max(0, stepDurationMs(current.phase) - elapsedMs);
  const cueTotalMs = cueMsForPhase(current.phase);
  const cueMs = cueTotalMs > 0 ? Math.max(0, cueTotalMs - elapsedMs) : undefined;
  return current.sheets.map(sheet => {
    const assignee = currentAssignee(players, sheet.ownerIndex, current.step);
    return {
      gameId: state.gameId ?? '',
      sheetId: sheet.sheetId,
      stepIndex: current.step,
      phase: current.phase,
      assigneeId: assignee.id,
      previousContent: toPreviousContent(sheet.steps[sheet.steps.length - 1]),
      durationSec: durationSecForPhase(current.phase),
      remainingMs,
      cueMs,
      totalSteps,
    };
  });
}

// 단계 정보는 담당자 본인에게만 보낸다 — 다른 사람의 시트(그림·글)를 미리 받을 이유가 없고,
// 시트마다 strokes가 실려 방 전체 broadcast는 N배의 전송량이 된다.
function emitSteps(game: GameNamespace, state: RoomState, current: Mode2Current): void {
  for (const payload of buildStepPayloads(state, current)) {
    game.to(`user:${payload.assigneeId}`).emit('mode2:step', payload);
  }
}

// startMode2/advanceStep의 mode2:step broadcast는 room:state 직후 발생하므로, 그 시점에
// 아직 모드2 화면이 mount되지 않은 클라이언트(화면 전환 중)는 첫 스텝 이벤트를 놓쳐
// 다음 스텝까지 까만 화면만 보게 된다. room:join 시 현재 스텝을 해당 소켓에만 재전송한다.
export function resendCurrentStep(
  socket: Pick<Socket<ClientEvents, ServerEvents>, 'emit'>,
  state: RoomState,
  userId: string,
): void {
  if (!isMode2Active(state.status)) return;
  const current = state.current as Mode2Current;
  for (const payload of buildStepPayloads(state, current)) {
    if (payload.assigneeId === userId) socket.emit('mode2:step', payload);
  }
}

function scheduleStepTimeout(game: GameNamespace, code: string, gameId: string | undefined, phase: Mode2Phase): void {
  setRoomTimer(code, 'mode2Step', stepDurationMs(phase) + MODE2_SUBMIT_GRACE_MS, () => advanceStep(game, code, gameId));
}

export async function startMode2(game: GameNamespace, code: string): Promise<void> {
  const state = await getRoomState(code);
  if (!state) return;

  const players = sortedPlayers(state);
  if (players.length < MODE2_PLAYER_MIN) {
    await endGame(game, code, 'INSUFFICIENT_PLAYERS');
    return;
  }

  const sheets: Mode2Sheet[] = players.map((p, i) => ({ sheetId: p.id, ownerIndex: i, steps: [] }));

  const current: Mode2Current = {
    step: 0,
    phase: 'PROMPT',
    sheets,
    submitted: [],
    drafts: {},
    startedAt: Date.now(),
  };

  state.status = 'MODE2_PROMPT_PHASE';
  state.current = current;
  await saveRoomState(state);
  game.to(`room:${code}`).emit(SERVER_EVENT.ROOM_STATE, state);

  emitSteps(game, state, current);
  scheduleStepTimeout(game, code, state.gameId, 'PROMPT');
}

async function assertAssignee(
  code: string,
  socket: Mode2Socket,
  sheetId: string,
): Promise<{ state: RoomState; current: Mode2Current; sheet: Mode2Sheet } | null> {
  const state = await getRoomState(code);
  if (!state || !isMode2Active(state.status)) return null;

  const current = state.current as Mode2Current;
  const sheet = current.sheets.find(s => s.sheetId === sheetId);
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
    if (stroke.paintSpans !== undefined) {
      if (!Number.isFinite(stroke.startTime) || stroke.startTime < 0) continue;
      const parsed = paintSpansSchema.safeParse(stroke.paintSpans);
      if (!parsed.success || !/^#[0-9a-f]{6}$/i.test(stroke.color)) continue;
      clean.push({
        id: stroke.id,
        authorId,
        color: stroke.color,
        width: 0,
        points: [],
        startTime: stroke.startTime,
        paintSpans: parsed.data,
      });
      continue;
    }
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
    clean.push({
      id: stroke.id,
      authorId,
      color: stroke.color,
      width: stroke.width,
      points,
      startTime: stroke.startTime,
    });
  }
  return clean;
}

function findRoomCode(socket: Mode2Socket): string | null {
  const roomName = Array.from(socket.rooms).find(r => r.startsWith('room:'));
  return roomName ? roomName.replace('room:', '') : null;
}

async function checkAllSubmitted(game: GameNamespace, code: string, current: Mode2Current): Promise<void> {
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

  const text = sanitizeText(payload.text);
  if (!text) return;
  ctx.sheet.steps.push({ kind: 'PROMPT', authorId: socket.data.userId, text });
  recordMode2Submit(ctx.state, socket.data.userId);
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

  const text = sanitizeText(payload.text);
  if (!text) return;
  ctx.sheet.steps.push({ kind: 'ANSWER', authorId: socket.data.userId, text });
  recordMode2Submit(ctx.state, socket.data.userId);
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

  const strokes = sanitizeStrokes(payload.strokes, socket.data.userId);
  if (strokes.length === 0) return;

  ctx.sheet.steps.push({
    kind: 'DRAW',
    authorId: socket.data.userId,
    strokes,
  });
  recordMode2Submit(ctx.state, socket.data.userId);
  ctx.current.submitted.push(payload.sheetId);
  await saveRoomState(ctx.state);
  await checkAllSubmitted(game, code, ctx.current);
}

// 작성 중이던 초안 저장 — 담당자 검증·입력 정제는 제출과 동일하게 적용한다 (브로드캐스트 없음)
export async function handleMode2Draft(
  socket: Mode2Socket,
  payload: { sheetId: string; text?: unknown; strokes?: unknown },
): Promise<void> {
  const code = findRoomCode(socket);
  if (!code) return;
  const ctx = await assertAssignee(code, socket, payload.sheetId);
  if (!ctx) return;

  ctx.current.drafts ??= {};
  if (ctx.current.phase === 'DRAW') {
    ctx.current.drafts[payload.sheetId] = { strokes: sanitizeStrokes(payload.strokes, socket.data.userId) };
  } else {
    ctx.current.drafts[payload.sheetId] = { text: sanitizeText(payload.text) };
  }
  await saveRoomState(ctx.state);
}

// 선택한 제시어 카테고리 중 하나를 균등 랜덤 선택 (모드1과 같은 기준 — 항상 첫 카테고리만 나오지 않도록)
function randomWordCategory(categories: Category[]): Category {
  const wordCategories = categories.filter(c => c !== 'CUSTOM');
  if (wordCategories.length === 0) return 'ANIMAL';
  return wordCategories[Math.floor(Math.random() * wordCategories.length)]!;
}

// 시간 초과로 제출하지 못한 시트의 콘텐츠 — 초안이 있으면 그대로 쓰고, 빈 제시어는 랜덤 단어로 채운다
async function timeoutContent(
  state: RoomState,
  current: Mode2Current,
  sheet: Mode2Sheet,
  authorId: string,
): Promise<Mode2StepContent> {
  const draft = current.drafts?.[sheet.sheetId];
  if (current.phase === 'DRAW') return { kind: 'DRAW', authorId, strokes: draft?.strokes ?? [] };
  const text = draft?.text ?? '';
  if (current.phase === 'ANSWER') return { kind: 'ANSWER', authorId, text };
  if (text) return { kind: 'PROMPT', authorId, text };
  const picked = await pickRoundWord(
    randomWordCategory(state.config.categories),
    state.config.categories,
    state.usedWords,
  );
  if (!picked) return { kind: 'PROMPT', authorId, text: FALLBACK_PROMPT };
  // 호출 측이 같은 state를 저장한다 — 한 게임 안에서 랜덤 제시어가 겹치지 않도록 기록
  state.usedWords = [...(state.usedWords ?? []), picked.word];
  return { kind: 'PROMPT', authorId, text: picked.word };
}

export async function advanceStep(game: GameNamespace, code: string, expectedGameId?: string): Promise<void> {
  const state = await getRoomState(code);
  if (!state || !isMode2Active(state.status)) return;
  if (expectedGameId !== undefined && state.gameId !== expectedGameId) return;
  clearRoomTimer(code, 'mode2Step');

  const current = state.current as Mode2Current;
  const players = sortedPlayers(state);

  // D-08: 미제출 시트는 작성 중이던 초안으로 강제 제출하고 다음 단계로 전환
  for (const sheet of current.sheets) {
    if (current.submitted.includes(sheet.sheetId)) continue;
    const assignee = currentAssignee(players, sheet.ownerIndex, current.step);
    sheet.steps.push(await timeoutContent(state, current, sheet, assignee.id));
  }

  const nextStep = current.step + 1;
  current.submitted = [];
  current.drafts = {};
  current.startedAt = Date.now();

  if (nextStep > finalStepForPlayerCount(players.length)) {
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

  emitSteps(game, state, current);
  scheduleStepTimeout(game, code, state.gameId, current.phase);
}

// OFFL-05/D-08: 모드2 전용 이탈 처리 — mode1의 handlePlayerLeft와는 별도 함수로 유지
export async function handleMode2PlayerLeft(game: GameNamespace, code: string, userId: string): Promise<void> {
  const state = await getRoomState(code);
  if (!state) return;

  const player = state.players.find(p => p.id === userId);
  if (!player || player.left) return; // 이미 처리됨

  player.connected = false;
  player.left = true;

  // 정답 공개식 중 이탈은 남은 사람들의 공개식을 끊지 않는다 — 시상식 명단에서만 뺀다
  if (state.status === 'MODE2_REVIEW') {
    player.inAward = false;
    await saveRoomState(state);
    game.to(`room:${code}`).emit(SERVER_EVENT.ROOM_STATE, state);
    return;
  }

  const activePlayers = state.players.filter(p => !p.left);

  // 텔레스테이션 룰은 최소 4명부터 성립한다.
  if (activePlayers.length < MODE2_PLAYER_MIN) {
    await saveRoomState(state);
    game.to(`room:${code}`).emit(SERVER_EVENT.ROOM_STATE, state);
    await endGame(game, code, 'INSUFFICIENT_PLAYERS');
    return;
  }

  await saveRoomState(state);
  game.to(`room:${code}`).emit(SERVER_EVENT.ROOM_STATE, state);

  if (!isMode2Active(state.status)) return;

  const current = state.current as Mode2Current;
  const players = sortedPlayers(state);
  for (const sheet of current.sheets) {
    if (current.submitted.includes(sheet.sheetId)) continue;
    const assignee = currentAssignee(players, sheet.ownerIndex, current.step);
    if (assignee.id !== userId) continue;
    sheet.steps.push(await timeoutContent(state, current, sheet, assignee.id));
    current.submitted.push(sheet.sheetId);
  }
  await saveRoomState(state);
  await checkAllSubmitted(game, code, current);
}
