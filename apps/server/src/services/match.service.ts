import { redis } from '../db/redis.js';
import { createRoom } from './rooms.service.js';
import { prisma } from '../db/prisma.js';

export type MatchPlayerCount = 6 | 8 | 10;

// D-08: 모드 1 고정 (MVP)
const matchQueueKey = (count: number) => `matchqueue:1:${count}`;

export async function enqueueMatch(
  userId: string,
  playerCount: MatchPlayerCount
): Promise<{ code: string } | null> {
  const key = matchQueueKey(playerCount);
  await redis.zadd(key, Date.now(), userId);
  return tryCreateMatch(key, playerCount);
}

export async function dequeueMatch(userId: string): Promise<void> {
  // 6/8/10 큐 전부에서 제거 (어느 큐에 있었는지 모름)
  await Promise.all([6, 8, 10].map((n) => redis.zrem(matchQueueKey(n), userId)));
}

async function tryCreateMatch(
  key: string,
  playerCount: number
): Promise<{ code: string } | null> {
  const count = await redis.zcount(key, '-inf', '+inf');
  if (count < playerCount) return null;

  // ZPOPMIN: 가장 먼저 들어온 순서로 playerCount명 pop
  const members = await redis.zpopmin(key, playerCount);
  // members = [member, score, member, score, ...] — i%2===0이 userId
  const userIds = members.filter((_, i) => i % 2 === 0);

  if (userIds.length < playerCount) {
    // Pitfall 7: 레이스 컨디션 — pop한 userId들을 다시 큐에 삽입 후 미성사 처리
    if (userIds.length > 0) {
      await redis.zadd(key, ...userIds.flatMap((id) => [Date.now(), id]));
    }
    return null;
  }

  // 매칭된 유저들의 메타 조회 (createRoom userMeta 구성)
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const userMeta = Object.fromEntries(
    users.map((u) => [u.id, { nickname: u.nickname, characterId: u.characterId }])
  );

  const state = await createRoom({
    hostId: userIds[0]!,
    userIds,
    config: {
      roundCount: 5,
      drawTimer: 30,
      answerTimer: 10,
      categories: ['ANIMAL', 'FOOD', 'OBJECT', 'NATURE', 'PLACE', 'ACTION', 'JOB'],
      playerCountMax: playerCount,
    },
    locked: false,
    mode: 1,
    userMeta,
  });

  return { code: state.code };
}
