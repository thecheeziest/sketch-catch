import type { Namespace } from 'socket.io';
import type { ClientEvents, ServerEvents, Mode1RoundCurrent } from '@sketch-catch/shared';
import { getRoomState, saveRoomState } from '../../services/rooms.service.js';
import { pickWord } from '../../services/word.service.js';

type GameNamespace = Namespace<ClientEvents, ServerEvents>;

// Pitfall 3: 타이머 레퍼런스를 모듈 레벨 Map으로 관리 — 정답/타임아웃 두 경로 모두 정리
export const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

// D-01: answeredAt 누적 Map (동점자 정렬용 — score DESC, answeredAt ASC)
const answerTimestamps = new Map<string, Map<string, number>>();

export function calcScore(elapsedMs: number): { guesserScore: number; drawerScore: number } {
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const guesserScore = Math.max(100, 1000 - elapsedSec * 30);
  const drawerScore = Math.min(500, Math.floor(guesserScore * 0.5));
  return { guesserScore, drawerScore };
}

export async function startRound(
  game: GameNamespace,
  code: string,
  roundIndex: number,
): Promise<void> {
  const state = await getRoomState(code);
  if (!state) return;

  // MD1-01: roundIndex % players.length 로 출제자 순환
  const drawer = state.players[roundIndex % state.players.length]!;

  const { word } = await pickWord(state.config.categories);

  state.status = 'MODE1_ROUND_START';
  state.current = {
    roundIndex,
    drawerId: drawer.id,
    prompt: word,
    startedAt: Date.now(),
  } satisfies Mode1RoundCurrent;

  await saveRoomState(state);

  // 단일 broadcast + 클라이언트에서 drawerId 본인일 때만 promptForDrawer 사용 (RESEARCH 채택 패턴)
  // 보안: 캐주얼 게임이므로 단일 broadcast 수용 (Open Question 1)
  game.to(`room:${code}`).emit('game:round:start', {
    roundIndex,
    drawerId: drawer.id,
    promptForDrawer: word,
    durationSec: state.config.drawTimer,
  });

  // MD1-05: drawTimer초 후 자동으로 라운드 종료
  clearTimeout(activeTimers.get(code));
  activeTimers.set(
    code,
    setTimeout(() => void endRound(game, code, roundIndex, null), state.config.drawTimer * 1000),
  );
}

export async function endRound(
  game: GameNamespace,
  code: string,
  roundIndex: number,
  correctUserId: string | null,
  answeredAtMs?: number,
): Promise<void> {
  // Pitfall 3: 두 경로(정답/타임아웃) 모두 타이머 정리
  clearTimeout(activeTimers.get(code));
  activeTimers.delete(code);

  const state = await getRoomState(code);
  if (!state) return;

  const current = state.current as Mode1RoundCurrent;
  const scoreDelta: Record<string, number> = {};

  if (correctUserId) {
    const elapsed = answeredAtMs ?? Date.now() - current.startedAt;
    const { guesserScore, drawerScore } = calcScore(elapsed);

    scoreDelta[correctUserId] = guesserScore;
    scoreDelta[current.drawerId] = drawerScore;

    // 스코어보드 누적
    state.scoreboard[correctUserId] = (state.scoreboard[correctUserId] ?? 0) + guesserScore;
    state.scoreboard[current.drawerId] = (state.scoreboard[current.drawerId] ?? 0) + drawerScore;

    // D-01: answeredAt 기록 (동점자 정렬용)
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

  // 다음 라운드 or 게임 종료
  if (roundIndex + 1 < state.config.roundCount) {
    // RoundResultOverlay 3초 대기 후 다음 라운드
    setTimeout(() => void startRound(game, code, roundIndex + 1), 3000);
  } else {
    await endGame(game, code);
  }
}

async function endGame(game: GameNamespace, code: string): Promise<void> {
  const state = await getRoomState(code);
  if (!state) return;

  state.status = 'AWARD';

  const timestamps = answerTimestamps.get(code) ?? new Map<string, number>();

  // D-01: score DESC, answeredAt ASC 정렬
  const ranked = [...Object.entries(state.scoreboard)]
    .sort(([userA, scoreA], [userB, scoreB]) => {
      if (scoreB !== scoreA) return scoreB - scoreA;
      const atA = timestamps.get(userA) ?? Infinity;
      const atB = timestamps.get(userB) ?? Infinity;
      return atA - atB;
    })
    .map(([userId, score], index) => ({
      userId,
      rank: index + 1,
      score,
      answeredAt: timestamps.get(userId) ?? null,
    }));

  await saveRoomState(state);

  // cleanup in-memory timestamps
  answerTimestamps.delete(code);

  game.to(`room:${code}`).emit('game:end', {
    finalScoreboard: state.scoreboard,
    ranking: ranked,
  });
}
