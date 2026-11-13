import { randomInt } from 'node:crypto';
import type { GamePenaltyResult, RoomPenalty } from '@sketch-catch/shared';
import { profanityFilter } from './profanity.js';

type RankedScore = { userId: string; score: number };
type PenaltyJudgement = Pick<GamePenaltyResult, 'loserIds' | 'draw'>;
// [0, max) 범위 정수 — 테스트에서 고정 값 주입용
type RandomInt = (max: number) => number;

// Fisher-Yates로 균등하게 섞은 뒤 앞에서 count명
function pickRandom<T>(items: T[], count: number, random: RandomInt): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count);
}

/**
 * 벌칙에 걸린 사람(꼴찌)을 고른다.
 * - 게임 중 나간 사람은 판정에서 빠진다 (남은 사람 중에서 꼴찌)
 * - 인원이 줄어 꼴찌 수가 남은 인원 이상이면 최소 1명은 단상에 남도록 줄인다
 * - 경계 점수 동점자가 남은 자리보다 많으면 동점자 중에서 무작위 추첨하고 draw에 후보를 담는다
 */
export function judgePenaltyLosers(
  ranking: RankedScore[],
  penalty: RoomPenalty,
  leftIds: Set<string>,
  random: RandomInt = randomInt,
): PenaltyJudgement {
  const candidates = ranking.filter(r => !leftIds.has(r.userId));
  const loserCount = Math.min(penalty.loserCount, candidates.length - 1);
  if (loserCount <= 0) return { loserIds: [] };

  const ascending = [...candidates].sort((a, b) => a.score - b.score);
  const threshold = ascending[loserCount - 1]!.score;
  const sure = candidates.filter(r => r.score < threshold).map(r => r.userId);
  const tied = candidates.filter(r => r.score === threshold).map(r => r.userId);
  const seats = loserCount - sure.length;
  if (tied.length <= seats) return { loserIds: [...sure, ...tied] };

  const picked = new Set(pickRandom(tied, seats, random));
  return {
    loserIds: [...sure, ...tied.filter(id => picked.has(id))],
    draw: { candidateIds: tied },
  };
}

// 벌칙 내용은 방 목록·대기실에 그대로 노출되므로 비속어가 있으면 마스킹 대신 거부한다
export function isPenaltyTextClean(text: string): boolean {
  return profanityFilter(text).matched.length === 0;
}
