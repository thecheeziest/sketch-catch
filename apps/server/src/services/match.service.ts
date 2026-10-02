import { redis, setPresence, setUserRoom } from '../db/redis.js';
import { createRoom } from './rooms.service.js';
import { prisma } from '../db/prisma.js';
import { emitToUser } from '../socket/game.namespace.js';
import { broadcastPresenceUpdate } from '../socket/presence.namespace.js';
import {
  SERVER_EVENT,
  ROOM_PLAYER_MIN,
  MODE2_PLAYER_MIN,
  ROOM_PLAYER_MAX,
  MATCH_COUNTDOWN_MS,
  MATCH_EXTEND_THRESHOLD_MS,
  MATCH_EXTEND_MS,
  MATCH_HARD_CAP_MS,
} from '@sketch-catch/shared';

export type GameMode = 1 | 2;

const membersKey = (mode: GameMode) => `matchlobby:${mode}:members`;
const deadlineKey = (mode: GameMode) => `matchlobby:${mode}:deadline`;
const startedAtKey = (mode: GameMode) => `matchlobby:${mode}:startedAt`;

// 서버 단일 프로세스 가정의 in-process 타이머로 카운트다운을 관리한다.
// Redis(deadline)가 source of truth이고 타이머는 "깨어나서 재확인"만 하므로,
// 여러 요청이 동시에 deadline을 연장해도 안전하다. 단, 서버 재시작 시 진행 중이던
// 카운트다운은 유실된다 — 재시작 시 남은 멤버가 다시 enqueue하며 자연 복구됨(Railway 단일 인스턴스 가정).
const pendingTimers = new Map<GameMode, NodeJS.Timeout>();

function minPlayersForMode(mode: GameMode): number {
  if (mode === 2) return MODE2_PLAYER_MIN;
  return ROOM_PLAYER_MIN;
}

export async function enqueueMatch(userId: string, mode: GameMode): Promise<void> {
  await redis.zadd(membersKey(mode), Date.now(), userId);
  await tick(mode);
}

export async function dequeueMatch(userId: string): Promise<void> {
  const removed = await Promise.all(
    ([1, 2] as const).map((mode) => redis.zrem(membersKey(mode), userId))
  );
  await Promise.all(
    ([1, 2] as const).filter((_, i) => removed[i] === 1).map((mode) => tick(mode))
  );
}

async function getMemberCount(mode: GameMode): Promise<number> {
  return redis.zcount(membersKey(mode), '-inf', '+inf');
}

async function broadcastLobbyUpdate(mode: GameMode, deadline: number | null): Promise<void> {
  const members = await redis.zrange(membersKey(mode), 0, -1);
  const payload = { mode, count: members.length, min: minPlayersForMode(mode), max: ROOM_PLAYER_MAX, deadline };
  members.forEach((userId) => emitToUser(userId, SERVER_EVENT.MATCH_UPDATE, payload));
}

function clearScheduledTimer(mode: GameMode): void {
  const timer = pendingTimers.get(mode);
  if (timer) clearTimeout(timer);
  pendingTimers.delete(mode);
}

function scheduleTimer(mode: GameMode, deadline: number): void {
  clearScheduledTimer(mode);
  const delay = Math.max(0, deadline - Date.now());
  pendingTimers.set(mode, setTimeout(() => void onDeadline(mode), delay));
}

// 큐 상태 변화(입장/이탈)마다 호출 — 카운트다운 시작/연장/즉시매칭/취소를 판단한다
async function tick(mode: GameMode): Promise<void> {
  const count = await getMemberCount(mode);
  const minPlayers = minPlayersForMode(mode);

  if (count === 0) {
    await redis.del(deadlineKey(mode), startedAtKey(mode));
    clearScheduledTimer(mode);
    return;
  }

  if (count < minPlayers) {
    // 최소 인원 미만으로 떨어짐 — 카운트다운 취소, 모으기 단계로 복귀
    await redis.del(deadlineKey(mode), startedAtKey(mode));
    clearScheduledTimer(mode);
    await broadcastLobbyUpdate(mode, null);
    return;
  }

  if (count >= ROOM_PLAYER_MAX) {
    await finalizeMatch(mode);
    return;
  }

  const now = Date.now();
  const [existingDeadline, existingStartedAt] = await Promise.all([
    redis.get(deadlineKey(mode)),
    redis.get(startedAtKey(mode)),
  ]);

  if (!existingDeadline) {
    // 최소 인원 최초 도달 — 카운트다운 시작
    const deadline = now + MATCH_COUNTDOWN_MS;
    await Promise.all([
      redis.set(deadlineKey(mode), String(deadline)),
      redis.set(startedAtKey(mode), String(now)),
    ]);
    scheduleTimer(mode, deadline);
    await broadcastLobbyUpdate(mode, deadline);
    return;
  }

  // 카운트다운 진행 중 — 막판 입장이면 하드 캡 내에서 연장
  const deadline = Number(existingDeadline);
  const startedAt = Number(existingStartedAt ?? now);
  const remaining = deadline - now;

  if (remaining < MATCH_EXTEND_THRESHOLD_MS) {
    const hardCap = startedAt + MATCH_HARD_CAP_MS;
    const nextDeadline = Math.min(now + MATCH_EXTEND_MS, hardCap);
    if (nextDeadline > deadline) {
      await redis.set(deadlineKey(mode), String(nextDeadline));
      scheduleTimer(mode, nextDeadline);
      await broadcastLobbyUpdate(mode, nextDeadline);
      return;
    }
  }

  await broadcastLobbyUpdate(mode, deadline);
}

// 타이머가 깨어났을 때 — 그 사이 deadline이 연장/취소됐을 수 있으므로 재확인 후 재스케줄 or 확정
async function onDeadline(mode: GameMode): Promise<void> {
  const existingDeadline = await redis.get(deadlineKey(mode));
  if (!existingDeadline) return; // 그새 취소됨 (인원 이탈로 최소 인원 미달 등)

  const deadline = Number(existingDeadline);
  if (deadline > Date.now()) {
    scheduleTimer(mode, deadline); // 연장된 채 아직 이 타이머가 못 깨어남 — 재스케줄
    return;
  }

  await finalizeMatch(mode);
}

async function finalizeMatch(mode: GameMode): Promise<void> {
  clearScheduledTimer(mode);
  await redis.del(deadlineKey(mode), startedAtKey(mode));

  // 큐 순서대로 최대 인원까지 pop (레이스 컨디션 방어 — Pitfall 7과 동일 패턴)
  const popped = await redis.zpopmin(membersKey(mode), ROOM_PLAYER_MAX);
  const userIds = popped.filter((_, i) => i % 2 === 0);

  if (userIds.length < minPlayersForMode(mode)) {
    if (userIds.length > 0) {
      await redis.zadd(membersKey(mode), ...userIds.flatMap((id) => [Date.now(), id]));
    }
    await broadcastLobbyUpdate(mode, null);
    return;
  }

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
      playerCountMax: ROOM_PLAYER_MAX,
    },
    locked: false,
    mode,
    userMeta,
  });

  await Promise.all(
    userIds.flatMap((id) => [setPresence(id, 'IN_LOBBY'), setUserRoom(id, state.code)])
  );
  userIds.forEach((id) => {
    broadcastPresenceUpdate(id, 'IN_LOBBY');
    emitToUser(id, SERVER_EVENT.MATCH_FOUND, { code: state.code });
  });
}
