import type { Namespace, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents, RoomState, Mode2ReviewSheet, Mode2ReviewState } from '@sketch-catch/shared';
import {
  MODE2_REVEAL_ENTRY_MS,
  MODE2_REVEAL_SHEET_GAP_MS,
  SERVER_EVENT,
  buildRevealEntries,
} from '@sketch-catch/shared';
import { getRoomState, saveRoomState } from '../../services/rooms.service.js';
import { generateSheetGifs } from '../../services/replay.service.js';
import { setRoomTimer } from '../../services/roomTimers.js';
import { clearRoomChat } from '../../services/chatStore.js';
import { logger } from '../../lib/logger.js';
import { phaseForStep, sortedPlayers, type Mode2Current } from './mode2.js';
import { beginAward } from './award.js';
import { settleMode2Rewards } from './coinReward.js';

type GameNamespace = Namespace<ClientEvents, ServerEvents>;

// RoomState.current에 저장되는 정답 공개식 진행 상태.
// entryStartsAt은 현재 발표의 애니메이션이 시작되는 서버 시각 — 새 시트의 첫 발표는 테두리 이동 시간만큼 미래다.
export type Mode2RevealCurrent = {
  sheets: Mode2ReviewSheet[];
  sheetIndex: number;
  entryIndex: number;
  entryStartsAt: number;
  finished: boolean;
};

function roomName(code: string): string {
  return `room:${code}`;
}

function toReviewState(state: RoomState, reveal: Mode2RevealCurrent): Mode2ReviewState {
  const now = Date.now();
  return {
    gameId: state.gameId ?? '',
    sheets: reveal.sheets,
    live: reveal.finished
      ? null
      : {
          sheetIndex: reveal.sheetIndex,
          entryIndex: reveal.entryIndex,
          leadMs: Math.max(0, reveal.entryStartsAt - now),
          elapsedMs: Math.max(0, now - reveal.entryStartsAt),
        },
  };
}

function emitReview(game: GameNamespace, state: RoomState, reveal: Mode2RevealCurrent): void {
  game.to(roomName(state.code)).emit(SERVER_EVENT.MODE2_REVIEW, toReviewState(state, reveal));
}

function isRevealCurrent(current: RoomState['current']): current is Mode2RevealCurrent {
  return typeof current === 'object' && current !== null && 'entryStartsAt' in current;
}

// 공개식 도중·직후 재입장한 소켓에 현재 진행 위치를 다시 보낸다 (화면 전환 중 이벤트 유실 대비)
export function resendReview(socket: Pick<Socket<ClientEvents, ServerEvents>, 'emit'>, state: RoomState): void {
  if (state.mode !== 2 || (state.status !== 'MODE2_REVIEW' && state.status !== 'AWARD')) return;
  if (!isRevealCurrent(state.current)) return;
  socket.emit(SERVER_EVENT.MODE2_REVIEW, toReviewState(state, state.current));
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
      },
    ];
  });
}

function entryCount(sheet: Mode2ReviewSheet | undefined): number {
  if (!sheet) return 0;
  return buildRevealEntries(sheet.steps.map(step => step.content)).length;
}

function scheduleNext(game: GameNamespace, state: RoomState, reveal: Mode2RevealCurrent): void {
  const { code, gameId } = state;
  const delayMs = Math.max(0, reveal.entryStartsAt - Date.now()) + MODE2_REVEAL_ENTRY_MS;
  setRoomTimer(code, 'review', delayMs, () => advanceReveal(game, code, gameId));
}

// MD2-03: 공개식 진입 — 원조자 순서대로 시트를 실시간 발표한다.
// 공개식 화면이 곧 모드 2의 시상식이므로 시작 시점부터 시상식 명단·채팅을 연다(한번 더는 발표가 끝난 AWARD부터).
export async function startMode2Review(game: GameNamespace, code: string): Promise<void> {
  const state = await getRoomState(code);
  if (!state) return;

  const mode2Current = state.current as Mode2Current;
  const sheets = buildReviewSheets(state, mode2Current);
  const reveal: Mode2RevealCurrent = {
    sheets,
    sheetIndex: 0,
    entryIndex: 0,
    entryStartsAt: Date.now() + MODE2_REVEAL_SHEET_GAP_MS,
    finished: false,
  };
  state.current = reveal;
  clearRoomChat(code);
  await beginAward(game, state);
  game.to(roomName(code)).emit(SERVER_EVENT.ROOM_STATE, state);
  emitReview(game, state, reveal);

  // D-10: GIF는 발표가 진행되는 동안 백그라운드로 만든다 — 방 작업 줄을 막지 않도록 기다리지 않는다
  const players = sortedPlayers(state).map(p => ({ id: p.id, nickname: p.nickname, characterId: p.characterId }));
  const participantIds = players.map(p => p.id);
  void generateSheetGifs(
    game,
    code,
    sheets.map(sheet => ({
      sheetId: sheet.sheetId,
      ownerId: sheet.ownerId,
      participantIds,
      players,
      steps: sheet.steps.map(step => step.content),
    })),
  ).catch(err => logger.error({ err, code }, 'mode2 gif generation failed'));

  if (sheets.length === 0) {
    await finishReveal(game, state, reveal);
    return;
  }
  scheduleNext(game, state, reveal);
}

async function advanceReveal(game: GameNamespace, code: string, expectedGameId?: string): Promise<void> {
  const state = await getRoomState(code);
  if (!state || state.status !== 'MODE2_REVIEW') return;
  if (expectedGameId !== undefined && state.gameId !== expectedGameId) return;
  if (!isRevealCurrent(state.current) || state.current.finished) return;
  const reveal = state.current;

  if (reveal.entryIndex + 1 < entryCount(reveal.sheets[reveal.sheetIndex])) {
    reveal.entryIndex += 1;
    reveal.entryStartsAt = Date.now();
  } else if (reveal.sheetIndex + 1 < reveal.sheets.length) {
    reveal.sheetIndex += 1;
    reveal.entryIndex = 0;
    reveal.entryStartsAt = Date.now() + MODE2_REVEAL_SHEET_GAP_MS;
  } else {
    await finishReveal(game, state, reveal);
    return;
  }

  await saveRoomState(state);
  emitReview(game, state, reveal);
  scheduleNext(game, state, reveal);
}

// 모든 발표가 끝나면 AWARD로 전환 — 이때부터 다시 보기·GIF 저장·한번 더가 열린다
async function finishReveal(game: GameNamespace, state: RoomState, reveal: Mode2RevealCurrent): Promise<void> {
  reveal.finished = true;
  state.current = reveal;
  state.status = 'AWARD';
  await saveRoomState(state);
  emitReview(game, state, reveal);
  game.to(roomName(state.code)).emit(SERVER_EVENT.ROOM_STATE, state);
  void settleMode2Rewards(game, state);
}
