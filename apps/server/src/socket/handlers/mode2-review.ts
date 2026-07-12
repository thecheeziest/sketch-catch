import type { Namespace } from 'socket.io';
import type {
  ClientEvents,
  ServerEvents,
  RoomState,
  Mode2ReviewSheet,
  Mode2StepContent,
} from '@sketch-catch/shared';
import { SERVER_EVENT } from '@sketch-catch/shared';
import { getRoomState, saveRoomState } from '../../services/rooms.service.js';
import { generateSheetGifs } from '../../services/replay.service.js';
import { phaseForStep, sortedPlayers, type Mode2Current } from './mode2.js';

type GameNamespace = Namespace<ClientEvents, ServerEvents>;
type Mode2ReviewSocket = { data: { userId: string }; rooms: Set<string> };

// D-01/D-03: 슬라이드쇼 프레임 표시 시간 — 텍스트 3초, 그림(정적) 4초 (UI-SPEC 6-4)
const TEXT_FRAME_MS = 3000;
const DRAW_FRAME_MS = 4000;
// D-08 강제진행 패턴을 판정 단계로 확장 — 15초 무응답 시 자동 O 처리 (UI-SPEC 6-4)
const JUDGE_TIMEOUT_MS = 15000;
// 베스트 투표 제한시간 (UI-SPEC 6-4, Claude's Discretion)
const VOTE_TIMEOUT_MS = 20000;
// BEST_REVEAL 연출 후 GIF 사전 생성 트리거까지 짧은 대기 (D-10)
const REVEAL_DELAY_MS = 4000;

// RoomState.current에 저장되는 리뷰 진행 상태 — 클라이언트 공개 타입 Mode2ReviewState에
// 서버 전용 투표 집계(votes)를 더한 슈퍼셋 (mode2.ts의 Mode2Current와 동일 패턴)
type Mode2ReviewCurrent = {
  subPhase: 'FINAL_JUDGE' | 'SLIDESHOW' | 'BEST_VOTE' | 'BEST_REVEAL';
  currentSheetIndex: number;
  currentFrameIndex?: number;
  sheets: Mode2ReviewSheet[];
  bestSheetIds?: string[];
  votes: Record<string, string>; // voterId -> sheetId (서버 전용 집계)
};

export const reviewTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearReviewTimer(code: string): void {
  clearTimeout(reviewTimers.get(code));
  reviewTimers.delete(code);
}

function roomName(code: string): string {
  return `room:${code}`;
}

function findRoomCode(socket: Mode2ReviewSocket): string | null {
  const found = Array.from(socket.rooms).find((r) => r.startsWith('room:'));
  return found ? found.replace('room:', '') : null;
}

function emitReview(game: GameNamespace, code: string, review: Mode2ReviewCurrent): void {
  game.to(roomName(code)).emit(SERVER_EVENT.MODE2_REVIEW, review);
}

// MD2-04/D-07: 최다 득표 시트 그룹 반환 (동률 공동 발표)
export function computeBestSheets(votes: Record<string, string>): string[] {
  const counts = new Map<string, number>();
  for (const sheetId of Object.values(votes)) {
    counts.set(sheetId, (counts.get(sheetId) ?? 0) + 1);
  }
  const max = Math.max(...counts.values(), 0);
  return [...counts.entries()].filter(([, count]) => count === max).map(([sheetId]) => sheetId);
}

function buildReviewSheets(state: RoomState, current: Mode2Current): Mode2ReviewSheet[] {
  const players = sortedPlayers(state);
  return current.sheets.flatMap((sheet): Mode2ReviewSheet[] => {
    const owner = players[sheet.ownerIndex];
    if (!owner) return []; // noUncheckedIndexedAccess 가드 — 발생하지 않아야 하는 케이스
    return [
      {
        sheetId: sheet.sheetId,
        ownerId: owner.id,
        steps: sheet.steps.map((content, stepIndex) => ({
          stepIndex,
          phase: phaseForStep(stepIndex),
          authorId: content.authorId,
          content,
        })),
        finalJudge: null,
      },
    ];
  });
}

// MD2-03: 리뷰 진입 — 시트별 최종 판정 대기부터 시작 (mode2.ts advanceStep에서 호출)
export async function startMode2Review(game: GameNamespace, code: string): Promise<void> {
  const state = await getRoomState(code);
  if (!state) return;

  const mode2Current = state.current as Mode2Current;
  const review: Mode2ReviewCurrent = {
    subPhase: 'FINAL_JUDGE',
    currentSheetIndex: 0,
    sheets: buildReviewSheets(state, mode2Current),
    votes: {},
  };
  state.current = review;
  await saveRoomState(state);
  emitReview(game, code, review);
  scheduleJudgeTimeout(game, code);
}

function scheduleJudgeTimeout(game: GameNamespace, code: string): void {
  clearReviewTimer(code);
  reviewTimers.set(
    code,
    setTimeout(() => void autoJudgeCurrentSheet(game, code), JUDGE_TIMEOUT_MS),
  );
}

async function autoJudgeCurrentSheet(game: GameNamespace, code: string): Promise<void> {
  const state = await getRoomState(code);
  if (!state || state.status !== 'MODE2_REVIEW') return;
  const review = state.current as Mode2ReviewCurrent;
  if (review.subPhase !== 'FINAL_JUDGE') return;

  const sheet = review.sheets[review.currentSheetIndex];
  if (!sheet || sheet.finalJudge) return;

  sheet.finalJudge = { ok: true, judgedBy: sheet.ownerId };
  state.current = review;
  await saveRoomState(state);
  await startSlideshow(game, code, state, review, sheet);
}

// D-02: 원조자가 마지막 단계 결과를 보고 O/X 1회 판정
export async function handleMode2JudgeFinal(
  game: GameNamespace,
  socket: Mode2ReviewSocket,
  payload: { sheetId: string; ok: boolean },
): Promise<void> {
  const code = findRoomCode(socket);
  if (!code) return;

  const state = await getRoomState(code);
  if (!state || state.status !== 'MODE2_REVIEW') return;
  const review = state.current as Mode2ReviewCurrent;
  if (review.subPhase !== 'FINAL_JUDGE') return;

  const sheet = review.sheets[review.currentSheetIndex];
  if (!sheet || sheet.sheetId !== payload.sheetId) return;
  if (sheet.ownerId !== socket.data.userId) return; // 원조자만 판정 가능 — 서버가 진실의 출처
  if (sheet.finalJudge) return; // D-02: 1회만

  clearReviewTimer(code);
  sheet.finalJudge = { ok: payload.ok, judgedBy: socket.data.userId };
  state.current = review;
  await saveRoomState(state);
  await startSlideshow(game, code, state, review, sheet);
}

async function startSlideshow(
  game: GameNamespace,
  code: string,
  state: RoomState,
  review: Mode2ReviewCurrent,
  sheet: Mode2ReviewSheet,
): Promise<void> {
  review.subPhase = 'SLIDESHOW';
  review.currentFrameIndex = 0;
  state.current = review;
  await saveRoomState(state);
  emitReview(game, code, review);
  scheduleFrame(game, code, sheet, 0);
}

function frameDurationMs(sheet: Mode2ReviewSheet, frameIndex: number): number {
  const frame = sheet.steps[frameIndex];
  return frame?.phase === 'DRAW' ? DRAW_FRAME_MS : TEXT_FRAME_MS;
}

function scheduleFrame(game: GameNamespace, code: string, sheet: Mode2ReviewSheet, frameIndex: number): void {
  clearReviewTimer(code);
  reviewTimers.set(
    code,
    setTimeout(() => void advanceFrame(game, code), frameDurationMs(sheet, frameIndex)),
  );
}

async function advanceFrame(game: GameNamespace, code: string): Promise<void> {
  const state = await getRoomState(code);
  if (!state || state.status !== 'MODE2_REVIEW') return;
  const review = state.current as Mode2ReviewCurrent;
  if (review.subPhase !== 'SLIDESHOW') return;

  const sheet = review.sheets[review.currentSheetIndex];
  if (!sheet) return;

  const nextFrame = (review.currentFrameIndex ?? 0) + 1;
  if (nextFrame >= sheet.steps.length) {
    const nextSheetIndex = review.currentSheetIndex + 1;
    if (nextSheetIndex >= review.sheets.length) {
      await startBestVote(game, code, state, review);
      return;
    }
    review.currentSheetIndex = nextSheetIndex;
    review.subPhase = 'FINAL_JUDGE';
    review.currentFrameIndex = undefined;
    state.current = review;
    await saveRoomState(state);
    emitReview(game, code, review);
    scheduleJudgeTimeout(game, code);
    return;
  }

  review.currentFrameIndex = nextFrame;
  state.current = review;
  await saveRoomState(state);
  emitReview(game, code, review);
  scheduleFrame(game, code, sheet, nextFrame);
}

async function startBestVote(
  game: GameNamespace,
  code: string,
  state: RoomState,
  review: Mode2ReviewCurrent,
): Promise<void> {
  review.subPhase = 'BEST_VOTE';
  review.currentFrameIndex = undefined;
  review.votes = {};
  state.current = review;
  await saveRoomState(state);
  emitReview(game, code, review);

  clearReviewTimer(code);
  reviewTimers.set(
    code,
    setTimeout(() => void finishBestVote(game, code), VOTE_TIMEOUT_MS),
  );
}

// MD2-04: 본인 소유 시트 제외, 1인 1표
export async function handleMode2VoteBest(
  game: GameNamespace,
  socket: Mode2ReviewSocket,
  payload: { sheetId: string },
): Promise<void> {
  const code = findRoomCode(socket);
  if (!code) return;

  const state = await getRoomState(code);
  if (!state || state.status !== 'MODE2_REVIEW') return;
  const review = state.current as Mode2ReviewCurrent;
  if (review.subPhase !== 'BEST_VOTE') return;

  const target = review.sheets.find((s) => s.sheetId === payload.sheetId);
  if (!target) return;
  if (target.ownerId === socket.data.userId) return; // 본인 소유 시트 투표 거부 (D-06)

  review.votes[socket.data.userId] = payload.sheetId;
  state.current = review;
  await saveRoomState(state);

  if (Object.keys(review.votes).length >= state.players.length) {
    await finishBestVote(game, code);
  }
}

async function finishBestVote(game: GameNamespace, code: string): Promise<void> {
  clearReviewTimer(code);

  const state = await getRoomState(code);
  if (!state || state.status !== 'MODE2_REVIEW') return;
  const review = state.current as Mode2ReviewCurrent;
  if (review.subPhase !== 'BEST_VOTE') return; // 전원 투표 완료와 타임아웃 경합 방지

  review.bestSheetIds = computeBestSheets(review.votes);
  review.subPhase = 'BEST_REVEAL';
  state.current = review;
  await saveRoomState(state);
  emitReview(game, code, review);

  reviewTimers.set(
    code,
    setTimeout(() => void finalizeReview(game, code), REVEAL_DELAY_MS),
  );
}

// D-10: 베스트 발표 후 참여 시트 GIF 사전 생성 트리거 + AWARD 전환
async function finalizeReview(game: GameNamespace, code: string): Promise<void> {
  const state = await getRoomState(code);
  if (!state || state.status !== 'MODE2_REVIEW') return;
  const review = state.current as Mode2ReviewCurrent;

  const participantIds = state.players.map((p) => p.id);
  await generateSheetGifs(
    game,
    code,
    review.sheets.map((sheet) => ({
      sheetId: sheet.sheetId,
      ownerId: sheet.ownerId,
      participantIds,
      steps: sheet.steps.map((step): Mode2StepContent => step.content),
    })),
  );

  state.status = 'AWARD';
  await saveRoomState(state);
  game.to(roomName(code)).emit(SERVER_EVENT.ROOM_STATE, state);
}
