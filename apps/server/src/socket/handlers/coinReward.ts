import type { Namespace } from 'socket.io';
import {
  SERVER_EVENT,
  type ClientEvents,
  type CoinRewardLine,
  type RoomState,
  type ServerEvents,
} from '@sketch-catch/shared';
import {
  computeMode1Lines,
  computeMode2Lines,
  createCoinStats,
  isRewardEligible,
  settleGameReward,
} from '../../services/coin.service.js';
import { logger } from '../../lib/logger.js';

type GameNamespace = Namespace<ClientEvents, ServerEvents>;

// 끝까지 남은 플레이어에게만 지급하고, 결과는 본인 소켓에만 보낸다.
// 정산 실패가 시상식 진행을 막지 않도록 호출 측은 await하지 않아도 된다.
async function settleAll(
  game: GameNamespace,
  state: RoomState,
  linesOf: (userId: string, finisherCount: number) => CoinRewardLine[],
): Promise<void> {
  const gameId = state.gameId;
  if (!gameId) return;
  const finishers = state.players.filter(p => !p.left);
  if (!isRewardEligible(finishers.length)) return;

  const results = await Promise.allSettled(
    finishers.map(async player => {
      const reward = await settleGameReward({
        userId: player.id,
        gameId,
        mode: state.mode,
        lines: linesOf(player.id, finishers.length),
      });
      if (reward) game.to(`user:${player.id}`).emit(SERVER_EVENT.COIN_REWARD, reward);
    }),
  );
  for (const result of results) {
    if (result.status === 'rejected') logger.error({ err: result.reason, gameId }, 'coin reward settle failed');
  }
}

export function settleMode1Rewards(
  game: GameNamespace,
  state: RoomState,
  ranking: Array<{ userId: string; rank: number }>,
): Promise<void> {
  const stats = state.coinStats ?? createCoinStats();
  const rankOf = new Map(ranking.map(r => [r.userId, r.rank]));
  return settleAll(game, state, (userId, finisherCount) =>
    computeMode1Lines({ userId, rank: rankOf.get(userId) ?? 0, playerCount: finisherCount, stats }),
  );
}

export function settleMode2Rewards(game: GameNamespace, state: RoomState): Promise<void> {
  const stats = state.coinStats ?? createCoinStats();
  return settleAll(game, state, userId => computeMode2Lines({ userId, stats }));
}
