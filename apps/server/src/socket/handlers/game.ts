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
import { clearRoomChat } from '../../services/chatStore.js';
import { resetToLobby } from '../../services/roomRules.js';
import { beginAward } from './award.js';

// 선택된 카테고리 중 이번 라운드에 사용할 카테고리 1개를 균등 랜덤 선택 (CUSTOM도 동일 확률의 후보)
function pickRoundCategory(categories: Category[]): Category {
  if (categories.length === 0) return 'ANIMAL';
  return categories[Math.floor(Math.random() * categories.length)]!;
}

type GameNamespace = Namespace<ClientEvents, ServerEvents>;

const CUSTOM_PROMPT_TIMEOUT_MS = PROMPT_DURATION_SEC * 1000;
const NEXT_ROUND_DELAY_MS = 3000;

// D-01: answeredAt 누적 Map (동점자 정렬용 — score DESC, answeredAt ASC)
const answerTimestamps = new Map<string, Map<string, number>>();

export function calcScore(elapsedMs: number): { guesserScore: number; drawerScore: number } {
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const guesserScore = Math.max(100, 1000 - elapsedSec * 30);
  const drawerScore = Math.min(500, Math.floor(guesserScore * 0.5));
  return { guesserScore, drawerScore };
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
  resetToLobby(state);
  await saveRoomState(state);
  game.to(`room:${state.code}`).emit(SERVER_EVENT.ROOM_STATE, state);
  game.to(`room:${state.code}`).emit(SERVER_EVENT.ERROR, {
    code: 'WORD_POOL_EMPTY',
    message: '제시어를 불러오지 못했어요. 잠시 후 다시 시작해 주세요.',
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
    // 커스텀 모드: 제시어 없이 시작, 출제자가 20초 내 직접 입력
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

  const picked = await pickRoundWord(roundCategory, state.config.categories);
  if (!picked) {
    await abortGame(game, state);
    return false;
  }

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
      promptHint: picked.word.replace(/[^ ]/gu, 'ㅇ'),
      isCustomRound: false,
      durationSec: state.config.drawTimer,
    });
  }

  setRoomTimer(code, 'round', state.config.drawTimer * 1000, () =>
    endRound(game, code, roundIndex, null, undefined, gameId),
  );
  return true;
}

// 커스텀 제시어 20초 초과 → 출제자 점수 차감 후 다음 턴
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
): Promise<void> {
  const roomName = Array.from(socket.rooms).find(r => r.startsWith('room:'));
  if (!roomName) return;
  const code = roomName.replace('room:', '');

  const state = await getRoomState(code);
  if (!state || state.status !== 'MODE1_ROUND_START') return;

  const current = state.current as Mode1RoundCurrent | null;
  if (!current || current.drawerId !== socket.data.userId) return;
  if (current.prompt !== '') return; // 이미 제시어가 설정된 경우 무시

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
      promptHint: prompt.replace(/[^ ]/gu, 'ㅇ'),
      isCustomRound: true,
      durationSec: state.config.drawTimer,
    });
  }

  // 커스텀 제시어 대기 타이머를 그림 타이머로 교체
  setRoomTimer(code, 'round', state.config.drawTimer * 1000, () =>
    endRound(game, code, current.roundIndex, null, undefined, gameId),
  );
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
  const payload: RoundStart = {
    gameId: state.gameId ?? '',
    roundIndex: current.roundIndex,
    drawerId: current.drawerId,
    durationSec: needsCustomPrompt
      ? Math.max(0, PROMPT_DURATION_SEC - elapsedSec)
      : Math.max(0, state.config.drawTimer - elapsedSec),
    isCustomRound: current.isCustomRound === true,
    promptHint: current.prompt.replace(/[^ ]/gu, 'ㅇ'),
    promptInputEndsAt: needsCustomPrompt ? current.startedAt + CUSTOM_PROMPT_TIMEOUT_MS : undefined,
  };
  if (needsCustomPrompt) payload.needsCustomPrompt = true;
  if (!needsCustomPrompt && current.drawerId === userId) payload.promptForDrawer = current.prompt;
  socket.emit('game:round:start', payload);
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
  const scoreDelta: Record<string, number> = {};

  if (correctUserId) {
    const elapsed = answeredAtMs ?? Date.now() - current.startedAt;
    const { guesserScore, drawerScore } = calcScore(elapsed);

    scoreDelta[correctUserId] = guesserScore;
    scoreDelta[current.drawerId] = drawerScore;

    state.scoreboard[correctUserId] = (state.scoreboard[correctUserId] ?? 0) + guesserScore;
    state.scoreboard[current.drawerId] = (state.scoreboard[current.drawerId] ?? 0) + drawerScore;

    if (!answerTimestamps.has(code)) answerTimestamps.set(code, new Map());
    answerTimestamps.get(code)!.set(correctUserId, elapsed);
  }

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

  const totalTurns = state.turnSchedule?.length ?? 0;
  if (roundIndex + 1 < totalTurns) {
    setRoomTimer(code, 'nextRound', NEXT_ROUND_DELAY_MS, async () => {
      await startRound(game, code, roundIndex + 1, gameId);
    });
  } else {
    await endGame(game, code);
  }
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

  // 퇴장 플레이어의 남은 턴 슬롯을 랜덤 활성 플레이어로 대체
  if (state.turnSchedule) {
    const currentRoundIndex = (state.current as Mode1RoundCurrent | null)?.roundIndex ?? 0;
    for (let i = currentRoundIndex + 1; i < state.turnSchedule.length; i++) {
      if (state.turnSchedule[i] === userId) {
        const pick = activePlayers[Math.floor(Math.random() * activePlayers.length)]!;
        state.turnSchedule[i] = pick.id;
      }
    }
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

  // 시상식 시작 — inAward 표시 + 시상식 만료 타이머 등록 후 저장
  await beginAward(game, state);

  // AWARD 상태를 클라이언트에 전파해 시상식 화면으로 이동하도록 함
  game.to(`room:${code}`).emit(SERVER_EVENT.ROOM_STATE, state);
  game.to(`room:${code}`).emit('game:end', {
    gameId: state.gameId ?? '',
    finalScoreboard: state.scoreboard,
    ranking: ranked,
    endReason: reason,
  });
}
