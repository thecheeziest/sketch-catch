import type { Namespace } from 'socket.io';
import type { ClientEvents, ServerEvents, Mode1RoundCurrent, RoomState, Category } from '@sketch-catch/shared';
import { SERVER_EVENT } from '@sketch-catch/shared';
import { getRoomState, saveRoomState } from '../../services/rooms.service.js';
import { pickWord } from '../../services/word.service.js';

// 선택된 카테고리 중 이번 라운드에 사용할 카테고리 1개를 균등 랜덤 선택 (CUSTOM도 동일 확률의 후보)
function pickRoundCategory(categories: Category[]): Category {
  if (categories.length === 0) return 'ANIMAL';
  return categories[Math.floor(Math.random() * categories.length)]!;
}

type GameNamespace = Namespace<ClientEvents, ServerEvents>;

// Pitfall 3: 타이머 레퍼런스를 모듈 레벨 Map으로 관리 — 정답/타임아웃 두 경로 모두 정리
export const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

// 커스텀 모드 제시어 입력 대기 타이머 (10초)
const customPromptTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

export async function startRound(
  game: GameNamespace,
  code: string,
  roundIndex: number,
): Promise<void> {
  const state = await getRoomState(code);
  if (!state || !state.turnSchedule) return;

  const drawerId = state.turnSchedule[roundIndex];
  if (!drawerId) return;

  const roundCategory = pickRoundCategory(state.config.categories);

  if (roundCategory === 'CUSTOM') {
    // 커스텀 모드: 제시어 없이 시작, 출제자가 10초 내 직접 입력
    state.status = 'MODE1_ROUND_START';
    state.current = {
      roundIndex,
      drawerId,
      prompt: '',
      startedAt: Date.now(),
    } satisfies Mode1RoundCurrent;

    await saveRoomState(state);

    game.to(`room:${code}`).emit('game:round:start', {
      roundIndex,
      drawerId,
      durationSec: state.config.drawTimer,
      needsCustomPrompt: true,
    });

    clearTimeout(customPromptTimers.get(code));
    customPromptTimers.set(
      code,
      setTimeout(async () => {
        customPromptTimers.delete(code);
        // 10초 초과 → 출제자 점수 차감 후 다음 턴
        const st = await getRoomState(code);
        if (!st || (st.current as Mode1RoundCurrent)?.prompt !== '') return;
        st.scoreboard[drawerId] = (st.scoreboard[drawerId] ?? 0) - 100;
        await saveRoomState(st);
        await endRound(game, code, roundIndex, null);
      }, 10_000),
    );
  } else {
    const { word } = await pickWord([roundCategory]);

    state.status = 'MODE1_ROUND_START';
    state.current = {
      roundIndex,
      drawerId,
      prompt: word,
      startedAt: Date.now(),
    } satisfies Mode1RoundCurrent;

    await saveRoomState(state);

    game.to(`room:${code}`).emit('game:round:start', {
      roundIndex,
      drawerId,
      promptForDrawer: word,
      durationSec: state.config.drawTimer,
    });

    clearTimeout(activeTimers.get(code));
    activeTimers.set(
      code,
      setTimeout(() => void endRound(game, code, roundIndex, null), state.config.drawTimer * 1000),
    );
  }
}

export async function handleCustomPromptSubmit(
  game: GameNamespace,
  socket: { rooms: Set<string>; data: { userId: string } },
  payload: { text: string },
): Promise<void> {
  const roomName = Array.from(socket.rooms).find((r) => r.startsWith('room:'));
  if (!roomName) return;
  const code = roomName.replace('room:', '');

  const state = await getRoomState(code);
  if (!state || state.status !== 'MODE1_ROUND_START') return;

  const current = state.current as Mode1RoundCurrent;
  if (current.drawerId !== socket.data.userId) return;
  if (current.prompt !== '') return; // 이미 제시어가 설정된 경우 무시

  const prompt = payload.text.trim().slice(0, 20);
  if (prompt.length === 0) return;

  clearTimeout(customPromptTimers.get(code));
  customPromptTimers.delete(code);

  current.prompt = prompt;
  current.startedAt = Date.now();
  await saveRoomState(state);

  // 출제자에게만 실제 제시어 전달
  game.to(`room:${code}`).emit('game:round:start', {
    roundIndex: current.roundIndex,
    drawerId: current.drawerId,
    promptForDrawer: prompt,
    durationSec: state.config.drawTimer,
  });

  clearTimeout(activeTimers.get(code));
  activeTimers.set(
    code,
    setTimeout(() => void endRound(game, code, current.roundIndex, null), state.config.drawTimer * 1000),
  );
}

export async function endRound(
  game: GameNamespace,
  code: string,
  roundIndex: number,
  correctUserId: string | null,
  answeredAtMs?: number,
): Promise<void> {
  clearTimeout(activeTimers.get(code));
  activeTimers.delete(code);

  const state = await getRoomState(code);
  if (!state) return;
  // 이미 종료된 라운드에 대한 중복 호출 방어 (출제자 퇴장 + 타이머 동시 발생 대비)
  if (state.status !== 'MODE1_ROUND_START') return;

  const current = state.current as Mode1RoundCurrent;
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

  game.to(`room:${code}`).emit('game:round:end', {
    roundIndex,
    correctUserId,
    scoreDelta,
  });

  const totalTurns = state.turnSchedule?.length ?? 0;
  if (roundIndex + 1 < totalTurns) {
    setTimeout(() => void startRound(game, code, roundIndex + 1), 3000);
  } else {
    await endGame(game, code);
  }
}

export async function handlePlayerLeft(
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

  // 1명 이하면 게임 즉시 종료
  if (activePlayers.length <= 1) {
    await saveRoomState(state);
    game.to(`room:${code}`).emit(SERVER_EVENT.ROOM_STATE, state);
    await endGame(game, code);
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

async function endGame(game: GameNamespace, code: string): Promise<void> {
  const state = await getRoomState(code);
  if (!state) return;

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

  await saveRoomState(state);
  answerTimestamps.delete(code);

  // AWARD 상태를 클라이언트에 전파해 시상식 화면으로 이동하도록 함
  game.to(`room:${code}`).emit(SERVER_EVENT.ROOM_STATE, state);
  game.to(`room:${code}`).emit('game:end', {
    finalScoreboard: state.scoreboard,
    ranking: ranked,
  });
}
