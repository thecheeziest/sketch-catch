import type { Namespace, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents, RoomState, Mode2ReviewSheet, Mode2RevealLive } from '@sketch-catch/shared';
import { SERVER_EVENT, buildRevealEntries, getSheetRevealDurationMs } from '@sketch-catch/shared';
import { getRoomState, saveRoomState } from '../../services/rooms.service.js';
import { saveReplays } from '../../services/replay.service.js';
import { getReviewSheets, saveReviewSheets } from '../../services/reviewStore.js';
import { setRoomTimer } from '../../services/roomTimers.js';
import { clearRoomChat } from '../../services/chatStore.js';
import { logger } from '../../lib/logger.js';
import { phaseForStep, sortedPlayers, type Mode2Current } from './mode2.js';
import { beginAward } from './award.js';
import { settleMode2Rewards } from './coinReward.js';

type GameNamespace = Namespace<ClientEvents, ServerEvents>;

// RoomState.current에 저장되는 정답 공개식 진행 상태 — 그림이 든 시트는 reviewStore에 따로 둔다.
// 서버는 시트 단위로만 넘기고, 시트 안의 발표 순서·단계는 기기가 sheetStartsAt 기준으로 직접 재생한다.
export type Mode2RevealCurrent = {
  sheetIndex: number;
  sheetStartsAt: number;
  entryCounts: number[];
  finished: boolean;
};

function roomName(code: string): string {
  return `room:${code}`;
}

function toLive(reveal: Mode2RevealCurrent): Mode2RevealLive | null {
  if (reveal.finished) return null;
  return { sheetIndex: reveal.sheetIndex, elapsedMs: Math.max(0, Date.now() - reveal.sheetStartsAt) };
}

function emitLive(game: GameNamespace, state: RoomState, reveal: Mode2RevealCurrent): void {
  game
    .to(roomName(state.code))
    .emit(SERVER_EVENT.MODE2_REVIEW_LIVE, { gameId: state.gameId ?? '', live: toLive(reveal) });
}

function isRevealCurrent(current: RoomState['current']): current is Mode2RevealCurrent {
  return typeof current === 'object' && current !== null && 'sheetStartsAt' in current;
}

// 공개식 도중·직후 재입장한 소켓에 시트 전체와 현재 진행 위치를 다시 보낸다 (화면 전환 중 이벤트 유실 대비)
export async function resendReview(
  socket: Pick<Socket<ClientEvents, ServerEvents>, 'emit'>,
  state: RoomState,
): Promise<void> {
  if (state.mode !== 2 || (state.status !== 'MODE2_REVIEW' && state.status !== 'AWARD')) return;
  if (!isRevealCurrent(state.current)) return;
  const sheets = await getReviewSheets(state.code);
  if (!sheets) return;
  socket.emit(SERVER_EVENT.MODE2_REVIEW, { gameId: state.gameId ?? '', sheets, live: toLive(state.current) });
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

function scheduleNext(game: GameNamespace, state: RoomState, reveal: Mode2RevealCurrent): void {
  const { code, gameId } = state;
  const endsAt = reveal.sheetStartsAt + getSheetRevealDurationMs(reveal.entryCounts[reveal.sheetIndex] ?? 0);
  setRoomTimer(code, 'review', Math.max(0, endsAt - Date.now()), () => advanceReveal(game, code, gameId));
}

// MD2-03: 공개식 진입 — 원조자 순서대로 시트를 실시간 발표한다.
// 공개식 화면이 곧 모드 2의 시상식이므로 시작 시점부터 시상식 명단·채팅을 연다(한번 더는 발표가 끝난 AWARD부터).
export async function startMode2Review(game: GameNamespace, code: string): Promise<void> {
  const state = await getRoomState(code);
  if (!state) return;

  const sheets = buildReviewSheets(state, state.current as Mode2Current);
  const reveal: Mode2RevealCurrent = {
    sheetIndex: 0,
    sheetStartsAt: Date.now(),
    entryCounts: sheets.map(sheet => buildRevealEntries(sheet.steps.map(step => step.content)).length),
    finished: false,
  };
  await saveReviewSheets(code, sheets);
  state.current = reveal;
  clearRoomChat(code);
  await beginAward(game, state);
  game.to(roomName(code)).emit(SERVER_EVENT.ROOM_STATE, state);
  game.to(roomName(code)).emit(SERVER_EVENT.MODE2_REVIEW, { gameId: state.gameId ?? '', sheets, live: toLive(reveal) });

  // D-10: GIF는 저장 요청 때 만든다 — 여기서는 다시 만들 수 있도록 시트만 기록한다 (발표를 기다리게 하지 않는다)
  const players = sortedPlayers(state);
  const participantIds = players.map(p => p.id);
  void saveReplays(
    code,
    sheets.map(sheet => ({
      sheetId: sheet.sheetId,
      ownerId: sheet.ownerId,
      participantIds,
      steps: sheet.steps.map(step => step.content),
    })),
  ).catch(err => logger.error({ err, code }, 'mode2 replay save failed'));

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

  if (reveal.sheetIndex + 1 >= reveal.entryCounts.length) {
    await finishReveal(game, state, reveal);
    return;
  }
  reveal.sheetIndex += 1;
  reveal.sheetStartsAt = Date.now();
  await saveRoomState(state);
  emitLive(game, state, reveal);
  scheduleNext(game, state, reveal);
}

// 모든 발표가 끝나면 AWARD로 전환 — 이때부터 다시 보기·GIF 저장·한번 더가 열린다
async function finishReveal(game: GameNamespace, state: RoomState, reveal: Mode2RevealCurrent): Promise<void> {
  reveal.finished = true;
  state.current = reveal;
  state.status = 'AWARD';
  await saveRoomState(state);
  emitLive(game, state, reveal);
  game.to(roomName(state.code)).emit(SERVER_EVENT.ROOM_STATE, state);
  void settleMode2Rewards(game, state);
}
