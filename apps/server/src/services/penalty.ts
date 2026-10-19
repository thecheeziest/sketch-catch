import type { RoomPenalty } from '@sketch-catch/shared';
import { profanityFilter } from './profanity.js';

type RankedScore = { userId: string; score: number };

/**
 * 벌칙에 걸린 사람(꼴찌)을 고른다.
 * - 게임 중 나간 사람은 판정에서 빠진다 (남은 사람 중에서 꼴찌)
 * - 인원이 줄어 꼴찌 수가 남은 인원 이상이면 최소 1명은 단상에 남도록 줄인다
 * - 꼴찌 경계 점수와 같은 사람은 모두 걸린다 (전원 동점이면 전원)
 */
export function judgePenaltyLosers(ranking: RankedScore[], penalty: RoomPenalty, leftIds: Set<string>): string[] {
  const candidates = ranking.filter(r => !leftIds.has(r.userId));
  const loserCount = Math.min(penalty.loserCount, candidates.length - 1);
  if (loserCount <= 0) return [];

  const ascending = [...candidates].sort((a, b) => a.score - b.score);
  const threshold = ascending[loserCount - 1]!.score;
  return candidates.filter(r => r.score <= threshold).map(r => r.userId);
}

// 벌칙 내용은 방 목록·대기실에 그대로 노출되므로 비속어가 있으면 마스킹 대신 거부한다
export function isPenaltyTextClean(text: string): boolean {
  return profanityFilter(text).matched.length === 0;
}
