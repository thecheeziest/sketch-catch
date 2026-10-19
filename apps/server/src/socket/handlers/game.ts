import type { Namespace, Socket } from 'socket.io';
import type {
  ClientEvents,
  ServerEvents,
  Mode1RoundCurrent,
  RoomState,
  Category,
  RoundStart,
} from '@sketch-catch/shared';
import { PROMPT_DURATION_SEC, SERVER_EVENT } from '@sketch-catch/shared';
import { getRoomState, saveRoomState } from '../../services/rooms.service.js';
import { pickRoundWord } from '../../services/word.service.js';
import { clearRoomTimer, clearRoomTimers, setRoomTimer } from '../../services/roomTimers.js';
import { clearRoomChat, listMessages } from '../../services/chatStore.js';
import { clearRoomStrokes, getRoundStrokes, hasRoundDrawing, strokeRoundKey } from '../../services/strokeStore.js';
import { resetToLobby } from '../../services/roomRules.js';
import { recordMode1Round } from '../../services/coin.service.js';
import { judgePenaltyLosers } from '../../services/penalty.js';
import { beginAward } from './award.js';
import { settleMode1Rewards } from './coinReward.js';

// 선택된 카테고리 중 이번 라운드에 사용할 카테고리 1개를 균등 랜덤 선택 (CUSTOM도 동일 확률의 후보)
function pickRoundCategory(categories: Category[]): Category {
  if (categories.length === 0) return 'ANIMAL';
  return categories[Math.floor(Math.random() * categories.length)]!;
}

type GameNamespace = Namespace<ClientEvents, ServerEvents>;

const CUSTOM_PROMPT_TIMEOUT_MS = PROMPT_DURATION_SEC * 1000;
const NEXT_ROUND_DELAY_MS = 5000;
// 남은 시간이 이 값에 도달하면 맞히는 사람에게 제시어 글자 수를 공개한다 (방 타이머가 30초든 60초든 동일)
const HINT_REVEAL_REMAINING_SEC = 10;

// 글자 수 힌트 — 공백은 유지하고 나머지 글자를 'ㅇ'으로 가린다
function toPromptHint(prompt: string): string {
  return prompt.replace(/[^ ]/gu, 'ㅇ');
}

// 라운드 시작(또는 커스텀 제시어 제출) 시점에 글자 수 공개 시각을 예약한다
function scheduleHint(
  game: GameNamespace,
  code: string,
  gameId: string | undefined,
  roundIndex: number,
  drawTimerSec: number,
): void {
  const delayMs = Math.max(0, drawTimerSec - HINT_REVEAL_REMAINING_SEC) * 1000;
  setRoomTimer(code, 'hint', delayMs, () => revealHint(game, code, gameId, roundIndex));
}

async function revealHint(
  game: GameNamespace,
  code: string,
  gameId: string | undefined,
  roundIndex: number,
): Promise<void> {
  const state = await getRoomState(code);
  if (!state || state.gameId !== gameId || state.status !== 'MODE1_ROUND_START') return;
  const current = state.current as Mode1RoundCurrent | null;
  if (!current || current.roundIndex !== roundIndex || current.prompt === '') return;
  game.to(`room:${code}`).emit(SERVER_EVENT.GAME_HINT, {
    gameId: gameId ?? '',
    roundIndex,
    promptHint: toPromptHint(current.prompt),
  });
}

// D-01: answeredAt 누적 Map (동점자 정렬용 — score DESC, answeredAt ASC)
const answerTimestamps = new Map<string, Map<string, number>>();

const GUESSER_BASE_SCORE = 500;
const GUESSER_SPEED_BONUS = 500;
const DRAWER_SCORE = 300;

// 맞힌 사람: 기본 500 + 남은 시간 비율만큼 최대 500 (방 타이머 길이와 무관하게 500~1000점).
// 출제자는 맞히기만 하면 고정 점수 — 라운드마다 점수 격차가 극단적으로 벌어지지 않게 한다.
export function calcScore(elapsedMs: number, drawTimerSec: number): { guesserScore: number; drawerScore: number } {
  const totalMs = drawTimerSec * 1000;
  const remainingRatio = totalMs > 0 ? Math.min(1, Math.max(0, (totalMs - elapsedMs) / totalMs)) : 0;
  const guesserScore = GUESSER_BASE_SCORE + Math.round(GUESSER_SPEED_BONUS * remainingRatio);
  return { guesserScore, drawerScore: DRAWER_SCORE };
}

/**
 * 게임 시작 시 1회 호출. 출제자 순서를 결정하는 turnSchedule 초기화.
 * 방장(slot 0)부터 입장 순서대로 각 플레이어가 turnCount번씩 출제.
 * ex) 4명·2턴 → [p0, p1, p2, p3, p0, p1, p2, p3]
 */
export function initTurnSchedule(state: RoomState): void {
  const activePlayers = [...state.players].sort((a, b) => a.slot - b.slot);
  const schedule: string[] = [];
  for (let t = 0; t < state.config.roundCount; t++) {
    for (const p of activePlayers) {
      schedule.push(p.id);
    }
  }
  state.turnSchedule = schedule;
}

// 제시어를 구할 수 없어 게임을 진행할 수 없을 때 — 대기실로 되돌리고 방 전체에 안내
async function abortGame(game: GameNamespace, state: RoomState): Promise<void> {
  clearRoomTimers(state.code);
  answerTimestamps.delete(state.code);
  clearRoomChat(state.code);
  clearRoomStrokes(state.code);
  resetToLobby(state);
  await saveRoomState(state);
  game.to(`room:${state.code}`).emit(SERVER_EVENT.ROOM_STATE, state);
  game.to(`room:${state.code}`).emit(SERVER_EVENT.ERROR, {
    code: 'WORD_POOL_EMPTY',
    message: '제시어를 못 불러왔어요. 다시 시작해 주세요!',
  });
}

/**
 * 라운드 시작. status와 current를 한 번에 저장한다 — 둘 사이에 이벤트가 끼어들면
 * current가 null인 채로 채팅이 처리되어 서버가 죽던 문제(R8) 방지.
 * @returns 라운드가 실제로 시작됐는지 (제시어를 못 구해 게임이 취소되면 false)
 */
export async function startRound(
  game: GameNamespace,
  code: string,
  roundIndex: number,
  expectedGameId?: string,
): Promise<boolean> {
  const state = await getRoomState(code);
  if (!state || !state.turnSchedule) return false;
  if (expectedGameId !== undefined && state.gameId !== expectedGameId) return false;

  const drawerId = state.turnSchedule[roundIndex];
  if (!drawerId) return false;

  const gameId = state.gameId;
  // 대기실에서 첫 라운드로 넘어갈 때만 room:state로 화면 전환을 알린다
  const isFirstRound = state.status === 'LOBBY';
  const roundCategory = pickRoundCategory(state.config.categories);
  const roomName = `room:${code}`;

  if (roundCategory === 'CUSTOM') {
    // 커스텀 모드: 제시어 없이 시작, 출제자가 30초 내 직접 입력
    state.status = 'MODE1_ROUND_START';
    state.current = {
      roundIndex,
      drawerId,
      prompt: '',
      isCustomRound: true,
      startedAt: Date.now(),
    } satisfies Mode1RoundCurrent;
    await saveRoomState(state);

    if (isFirstRound) game.to(roomName).emit(SERVER_EVENT.ROOM_STATE, state);
    game.to(roomName).emit('game:round:start', {
      gameId: gameId ?? '',
      roundIndex,
      drawerId,
      durationSec: PROMPT_DURATION_SEC,
      isCustomRound: true,
      promptInputEndsAt: Date.now() + CUSTOM_PROMPT_TIMEOUT_MS,
      needsCustomPrompt: true,
    });

    setRoomTimer(code, 'round', CUSTOM_PROMPT_TIMEOUT_MS, () =>
      handleCustomPromptTimeout(game, code, gameId, roundIndex, drawerId),
    );
    return true;
  }

  const picked = await pickRoundWord(roundCategory, state.config.categories, state.usedWords);
  if (!picked) {
    await abortGame(game, state);
    return false;
  }
  state.usedWords = [...(state.usedWords ?? []), picked.word];

  state.status = 'MODE1_ROUND_START';
  state.current = { roundIndex, drawerId, prompt: picked.word, startedAt: Date.now() } satisfies Mode1RoundCurrent;
  await saveRoomState(state);

  if (isFirstRound) game.to(roomName).emit(SERVER_EVENT.ROOM_STATE, state);
  for (const player of state.players.filter(p => !p.left)) {
    game.to(`user:${player.id}`).emit('game:round:start', {
      gameId: gameId ?? '',
      roundIndex,
      drawerId,
      promptForDrawer: player.id === drawerId ? picked.word : undefined,
      isCustomRound: false,
      durationSec: state.config.drawTimer,
    });
  }

  setRoomTimer(code, 'round', state.config.drawTimer * 1000, () =>
    endRound(game, code, roundIndex, null, undefined, gameId),
  );
  scheduleHint(game, code, gameId, roundIndex, state.config.drawTimer);
  return true;
}

// 커스텀 제시어 30초 초과 → 출제자 점수 차감 후 다음 턴
async function handleCustomPromptTimeout(
  game: GameNamespace,
  code: string,
  gameId: string | undefined,
  roundIndex: number,
  drawerId: string,
): Promise<void> {
  const state = await getRoomState(code);
  if (!state || state.gameId !== gameId || state.status !== 'MODE1_ROUND_START') return;
  const current = state.current as Mode1RoundCurrent | null;
  if (!current || current.roundIndex !== roundIndex || current.prompt !== '') return;

  state.scoreboard[drawerId] = (state.scoreboard[drawerId] ?? 0) - 100;
  await saveRoomState(state);
  await endRound(game, code, roundIndex, null, undefined, gameId);
}

export async function handleCustomPromptSubmit(
  game: GameNamespace,
  socket: { rooms: Set<string>; data: { userId: string } },
  payload: { text: string },
  receivedAt = Date.now(),
): Promise<void> {
  const roomName = Array.from(socket.rooms).find(r => r.startsWith('room:'));
  if (!roomName) return;
  const code = roomName.replace('room:', '');

  const state = await getRoomState(code);
  if (!state || state.status !== 'MODE1_ROUND_START') return;

  const current = state.current as Mode1RoundCurrent | null;
  if (!current || current.drawerId !== socket.data.userId) return;
  if (current.prompt !== '' || !current.isCustomRound) return;
  if (receivedAt >= current.startedAt + CUSTOM_PROMPT_TIMEOUT_MS) return;

  const prompt = payload.text.trim().slice(0, 20);
  if (prompt.length === 0) return;

  current.prompt = prompt;
  current.startedAt = Date.now();
  await saveRoomState(state);

  const gameId = state.gameId;
  // 출제자에게만 실제 제시어 전달
  for (const player of state.players.filter(p => !p.left)) {
    game.to(`user:${player.id}`).emit('game:round:start', {
      gameId: gameId ?? '',
      roundIndex: current.roundIndex,
      drawerId: current.drawerId,
      promptForDrawer: player.id === current.drawerId ? prompt : undefined,
      isCustomRound: true,
      durationSec: state.config.drawTimer,
    });
  }

  // 커스텀 제시어 대기 타이머를 그림 타이머로 교체
  setRoomTimer(code, 'round', state.config.drawTimer * 1000, () =>
    endRound(game, code, current.roundIndex, null, undefined, gameId),
  );
  scheduleHint(game, code, gameId, current.roundIndex, state.config.drawTimer);
}

// 진행 중 라운드에 (재)입장한 소켓에만 현재 라운드를 다시 보낸다 — 화면 전환 중 첫 round:start를
// 놓쳐 화면이 멈추던 문제 방지. 남은 시간 기준으로 durationSec을 보정한다.
export function resendCurrentRound(
  socket: Pick<Socket<ClientEvents, ServerEvents>, 'emit'>,
  state: RoomState,
  userId: string,
): void {
  if (state.status !== 'MODE1_ROUND_START') return;
  const current = state.current as Mode1RoundCurrent | null;
  if (!current) return;

  const needsCustomPrompt = current.prompt === '';
  const elapsedSec = Math.floor((Date.now() - current.startedAt) / 1000);
  const remainingSec = Math.max(0, state.config.drawTimer - elapsedSec);
  const payload: RoundStart = {
    gameId: state.gameId ?? '',
    roundIndex: current.roundIndex,
    drawerId: current.drawerId,
    durationSec: needsCustomPrompt ? Math.max(0, PROMPT_DURATION_SEC - elapsedSec) : remainingSec,
    isCustomRound: current.isCustomRound === true,
    promptInputEndsAt: needsCustomPrompt ? current.startedAt + CUSTOM_PROMPT_TIMEOUT_MS : undefined,
  };
  // 재접속한 시점에 이미 글자 수 공개 시각이 지났다면 함께 내려준다
  if (!needsCustomPrompt && remainingSec <= HINT_REVEAL_REMAINING_SEC)
    payload.promptHint = toPromptHint(current.prompt);
  if (needsCustomPrompt) payload.needsCustomPrompt = true;
  if (!needsCustomPrompt && current.drawerId === userId) payload.promptForDrawer = current.prompt;
  socket.emit('game:round:start', payload);
}

// 재접속한 소켓에 끊겨 있던 동안의 게임 채팅과 현재 라운드 그림을 보낸다 — resendCurrentRound 뒤에 호출해야
// 새 라운드로 넘어간 클라이언트가 캔버스를 비운 다음 그림을 받는다.
export function resendRoundHistory(socket: Pick<Socket<ClientEvents, ServerEvents>, 'emit'>, state: RoomState): void {
  if (state.status !== 'MODE1_ROUND_START' && state.status !== 'MODE1_ROUND_END') return;
  const gameId = state.gameId ?? '';
  socket.emit(SERVER_EVENT.CHAT_SYNC, { gameId, messages: listMessages(state.code) });

  const current = state.current as Mode1RoundCurrent | null;
  if (state.status !== 'MODE1_ROUND_START' || !current) return;
  socket.emit(SERVER_EVENT.STROKE_SYNC, {
    gameId,
    roundIndex: current.roundIndex,
    strokes: getRoundStrokes(state.code, strokeRoundKey(state.gameId, current.roundIndex)),
  });
}

export async function endRound(
  game: GameNamespace,
  code: string,
  roundIndex: number,
  correctUserId: string | null,
  answeredAtMs?: number,
  expectedGameId?: string,
): Promise<void> {
  const state = await getRoomState(code);
  if (!state) return;
  if (expectedGameId !== undefined && state.gameId !== expectedGameId) return;
  // 이미 종료된 라운드·다른 라운드에 대한 중복 호출 방어 (동시 정답, 출제자 퇴장 + 타이머 동시 발생 등)
  if (state.status !== 'MODE1_ROUND_START') return;
  const current = state.current as Mode1RoundCurrent | null;
  if (!current || current.roundIndex !== roundIndex) return;

  clearRoomTimer(code, 'round');
  clearRoomTimer(code, 'hint');
  const scoreDelta: Record<string, number> = {};

  if (correctUserId) {
    const elapsed = answeredAtMs ?? Date.now() - current.startedAt;
    const { guesserScore, drawerScore } = calcScore(elapsed, state.config.drawTimer);

    scoreDelta[correctUserId] = guesserScore;
    scoreDelta[current.drawerId] = drawerScore;

    state.scoreboard[correctUserId] = (state.scoreboard[correctUserId] ?? 0) + guesserScore;
    state.scoreboard[current.drawerId] = (state.scoreboard[current.drawerId] ?? 0) + drawerScore;

    if (!answerTimestamps.has(code)) answerTimestamps.set(code, new Map());
    answerTimestamps.get(code)!.set(correctUserId, elapsed);
  }

  recordMode1Round(state, {
    drawerId: current.drawerId,
    correctUserId,
    drewSomething: hasRoundDrawing(code, strokeRoundKey(state.gameId, roundIndex)),
  });

  state.status = 'MODE1_ROUND_END';
  await saveRoomState(state);

  const gameId = state.gameId;
  game.to(`room:${code}`).emit('game:round:end', {
    gameId: gameId ?? '',
    roundIndex,
    correctUserId,
    scoreDelta,
    answer: current.prompt,
  });

  // 다음 라운드 여부는 실행 시점의 출제 순서로 판단한다 — 대기 중 누가 나가면 순서가 줄어든다
  setRoomTimer(code, 'nextRound', NEXT_ROUND_DELAY_MS, async () => {
    const latest = await getRoomState(code);
    if (!latest || latest.gameId !== gameId || latest.status !== 'MODE1_ROUND_END') return;
    if (roundIndex + 1 < (latest.turnSchedule?.length ?? 0)) {
      await startRound(game, code, roundIndex + 1, gameId);
      return;
    }
    await endGame(game, code);
  });
}

export async function handlePlayerLeft(game: GameNamespace, code: string, userId: string): Promise<void> {
  const state = await getRoomState(code);
  if (!state) return;

  const player = state.players.find(p => p.id === userId);
  if (!player || player.left) return; // 이미 처리됨

  player.connected = false;
  player.left = true;

  const activePlayers = state.players.filter(p => !p.left);

  // 3명 미만이면 게임 즉시 종료 (D-03)
  if (activePlayers.length < 3) {
    await saveRoomState(state);
    game.to(`room:${code}`).emit(SERVER_EVENT.ROOM_STATE, state);
    await endGame(game, code, 'INSUFFICIENT_PLAYERS');
    return;
  }

  // 퇴장 플레이어의 남은 턴만 빼서 나머지 순서를 그대로 당긴다 (A B C D A B C D → D 퇴장 → A B C A B C).
  // 다른 플레이어로 채우면 같은 사람이 연달아 출제하게 된다. 지난·현재 라운드 인덱스는 그대로 유지된다.
  if (state.turnSchedule) {
    const currentRoundIndex = (state.current as Mode1RoundCurrent | null)?.roundIndex ?? 0;
    state.turnSchedule = state.turnSchedule.filter((id, i) => i <= currentRoundIndex || id !== userId);
  }

  await saveRoomState(state);
  game.to(`room:${code}`).emit(SERVER_EVENT.ROOM_STATE, state);

  // 퇴장 플레이어가 현재 출제자면 라운드 즉시 종료
  const currentDrawerId = (state.current as Mode1RoundCurrent | null)?.drawerId;
  const currentRoundIndex = (state.current as Mode1RoundCurrent | null)?.roundIndex ?? 0;
  if (state.status === 'MODE1_ROUND_START' && currentDrawerId === userId) {
    await endRound(game, code, currentRoundIndex, null);
  }
}

export async function endGame(game: GameNamespace, code: string, reason?: 'INSUFFICIENT_PLAYERS'): Promise<void> {
  const state = await getRoomState(code);
  if (!state) return;
  // 이미 시상식으로 넘어간 게임에 대한 중복 종료 방어
  if (state.status === 'AWARD') return;

  // 이 게임의 남은 타이머(라운드·다음 라운드 예약 등)를 전부 정리 — 끝난 게임이 되살아나지 않도록
  clearRoomTimers(code);
  clearRoomChat(code);
  clearRoomStrokes(code);

  state.status = 'AWARD';

  const timestamps = answerTimestamps.get(code) ?? new Map<string, number>();

  // 전원 랭킹에 포함 — scoreboard에 없는 플레이어(득점 전 강제종료 등)도 0점으로 표시되어야 캐릭터가 보임
  const ranked = [...state.players]
    .sort((a, b) => {
      const scoreA = state.scoreboard[a.id] ?? 0;
      const scoreB = state.scoreboard[b.id] ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      const atA = timestamps.get(a.id) ?? Infinity;
      const atB = timestamps.get(b.id) ?? Infinity;
      return atA - atB;
    })
    .map((player, index) => ({
      userId: player.id,
      rank: index + 1,
      score: state.scoreboard[player.id] ?? 0,
      answeredAt: timestamps.get(player.id) ?? null,
    }));

  answerTimestamps.delete(code);

  // 벌칙은 모드 1 정상 종료일 때만 — 인원 부족 조기 종료는 일반 시상식으로 끝낸다
  const penaltyConfig = state.mode === 1 && reason === undefined ? state.config.penalty : undefined;
  const penalty = penaltyConfig && {
    text: penaltyConfig.text,
    loserIds: judgePenaltyLosers(ranked, penaltyConfig, new Set(state.players.filter(p => p.left).map(p => p.id))),
  };

  // 시상식 시작 — inAward 표시 + 선택 전까지 결과 유지
  await beginAward(game, state);

  // AWARD 상태를 클라이언트에 전파해 시상식 화면으로 이동하도록 함
  game.to(`room:${code}`).emit(SERVER_EVENT.ROOM_STATE, state);
  game.to(`room:${code}`).emit('game:end', {
    gameId: state.gameId ?? '',
    finalScoreboard: state.scoreboard,
    ranking: ranked,
    endReason: reason,
    penalty,
  });

  void settleMode1Rewards(game, state, ranked);
}
