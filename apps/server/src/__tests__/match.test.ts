import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SERVER_EVENT } from '@sketch-catch/shared';

// 실제 ioredis 대신 ZSET/문자열 키만 지원하는 in-memory fake — match.service가 쓰는 명령만 구현
const { zsets, strings } = vi.hoisted(() => ({
  zsets: new Map<string, Map<string, number>>(),
  strings: new Map<string, string>(),
}));

function zsetOf(key: string): Map<string, number> {
  let z = zsets.get(key);
  if (!z) {
    z = new Map();
    zsets.set(key, z);
  }
  return z;
}

vi.mock('../db/redis.js', () => ({
  redis: {
    zadd: vi.fn(async (key: string, score: number, member: string) => {
      zsetOf(key).set(member, score);
      return 1;
    }),
    zrem: vi.fn(async (key: string, member: string) => {
      const z = zsets.get(key);
      if (!z || !z.has(member)) return 0;
      z.delete(member);
      return 1;
    }),
    zcount: vi.fn(async (key: string) => zsets.get(key)?.size ?? 0),
    zrange: vi.fn(async (key: string) => {
      const z = zsets.get(key);
      if (!z) return [];
      return [...z.entries()].sort((a, b) => a[1] - b[1]).map(([m]) => m);
    }),
    zpopmin: vi.fn(async (key: string, count: number) => {
      const z = zsets.get(key);
      if (!z) return [];
      const popped = [...z.entries()].sort((a, b) => a[1] - b[1]).slice(0, count);
      const out: string[] = [];
      for (const [member, score] of popped) {
        z.delete(member);
        out.push(member, String(score));
      }
      return out;
    }),
    get: vi.fn(async (key: string) => strings.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      strings.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (...keys: string[]) => {
      let n = 0;
      for (const key of keys) {
        if (strings.delete(key)) n++;
        if (zsets.delete(key)) n++;
      }
      return n;
    }),
  },
  setPresence: vi.fn(),
  setUserRoom: vi.fn(),
  getPresence: vi.fn(),
}));

vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => ({ id, nickname: id, characterId: 'CAT_01', friendCode: id }))
      ),
    },
  },
}));

vi.mock('../services/rooms.service.js', () => ({
  createRoom: vi.fn(async (opts: { hostId: string; userIds: string[]; mode: 1 | 2 }) => ({
    code: 'ABC123',
    hostId: opts.hostId,
    mode: opts.mode,
    status: 'LOBBY',
    players: [],
    config: { roundCount: 5, drawTimer: 30, answerTimer: 10, categories: ['ANIMAL'], playerCountMax: 12 },
    scoreboard: {},
    current: null,
  })),
}));

vi.mock('../socket/game.namespace.js', () => ({
  emitToUser: vi.fn(),
}));

vi.mock('../socket/presence.namespace.js', () => ({
  broadcastPresenceUpdate: vi.fn(),
}));

import { enqueueMatch, dequeueMatch } from '../services/match.service.js';
import { redis, setPresence, setUserRoom } from '../db/redis.js';
import { createRoom } from '../services/rooms.service.js';
import { emitToUser } from '../socket/game.namespace.js';
import { broadcastPresenceUpdate } from '../socket/presence.namespace.js';

const mockedCreateRoom = vi.mocked(createRoom);
const mockedEmitToUser = vi.mocked(emitToUser);

const T0 = new Date('2026-01-01T00:00:00.000Z').getTime();

beforeEach(() => {
  vi.clearAllMocks();
  zsets.clear();
  strings.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('match.service', () => {
  it('MATCH-01: enqueueMatch가 matchlobby:{mode}:members ZSET에 userId를 ZADD한다', async () => {
    await enqueueMatch('u1', 1);
    expect(redis.zadd).toHaveBeenCalledWith('matchlobby:1:members', T0, 'u1');
  });

  it('MATCH-02: 최소 인원(3명) 도달 시 카운트다운을 시작하고 로비 전원에게 match:update를 push한다', async () => {
    await enqueueMatch('u1', 1);
    await enqueueMatch('u2', 1);
    mockedEmitToUser.mockClear();

    await enqueueMatch('u3', 1);

    const deadline = T0 + 20_000;
    (['u1', 'u2', 'u3'] as const).forEach((id) => {
      expect(mockedEmitToUser).toHaveBeenCalledWith(id, SERVER_EVENT.MATCH_UPDATE, {
        mode: 1,
        count: 3,
        min: 3,
        max: 12,
        deadline,
      });
    });
    expect(mockedCreateRoom).not.toHaveBeenCalled();
  });

  it('MATCH-02B: 모드2는 최소 인원 4명 도달 시 카운트다운을 시작한다', async () => {
    await enqueueMatch('u1', 2);
    await enqueueMatch('u2', 2);
    await enqueueMatch('u3', 2);

    expect(mockedCreateRoom).not.toHaveBeenCalled();
    expect(strings.get('matchlobby:2:deadline')).toBeUndefined();

    mockedEmitToUser.mockClear();
    await enqueueMatch('u4', 2);

    const deadline = T0 + 20_000;
    (['u1', 'u2', 'u3', 'u4'] as const).forEach((id) => {
      expect(mockedEmitToUser).toHaveBeenCalledWith(id, SERVER_EVENT.MATCH_UPDATE, {
        mode: 2,
        count: 4,
        min: 4,
        max: 12,
        deadline,
      });
    });
  });

  it('MATCH-03: 카운트다운(20초) 종료 시 방을 생성하고 로비 전원에게 match:found를 push한다', async () => {
    await enqueueMatch('u1', 1);
    await enqueueMatch('u2', 1);
    await enqueueMatch('u3', 1);

    await vi.advanceTimersByTimeAsync(20_000);

    expect(mockedCreateRoom).toHaveBeenCalledOnce();
    expect(mockedCreateRoom).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 1, userIds: ['u1', 'u2', 'u3'] })
    );
    (['u1', 'u2', 'u3'] as const).forEach((id) => {
      expect(mockedEmitToUser).toHaveBeenCalledWith(id, SERVER_EVENT.MATCH_FOUND, { code: 'ABC123' });
      expect(setUserRoom).toHaveBeenCalledWith(id, 'ABC123');
      expect(setPresence).toHaveBeenCalledWith(id, 'IN_LOBBY');
      expect(broadcastPresenceUpdate).toHaveBeenCalledWith(id, 'IN_LOBBY');
    });
  });

  it('MATCH-04: 카운트다운 잔여 5초 미만에 입장하면 8초로 연장한다', async () => {
    await enqueueMatch('u1', 1);
    await enqueueMatch('u2', 1);
    await enqueueMatch('u3', 1); // deadline = T0+20000

    await vi.advanceTimersByTimeAsync(16_000); // remaining = 4000 < 5000
    mockedEmitToUser.mockClear();
    await enqueueMatch('u4', 1);

    const expectedDeadline = T0 + 16_000 + 8_000;
    expect(mockedEmitToUser).toHaveBeenCalledWith('u4', SERVER_EVENT.MATCH_UPDATE, {
      mode: 1,
      count: 4,
      min: 3,
      max: 12,
      deadline: expectedDeadline,
    });
    expect(mockedCreateRoom).not.toHaveBeenCalled();
  });

  it('MATCH-05: 연장은 카운트다운 시작 후 45초(하드 캡)를 넘지 못한다', async () => {
    await enqueueMatch('u1', 1);
    await enqueueMatch('u2', 1);
    await enqueueMatch('u3', 1); // startedAt=T0, deadline=T0+20000

    await vi.advanceTimersByTimeAsync(19_000); // T0+19000, remaining 1000<5000
    await enqueueMatch('u4', 1); // deadline → T0+27000

    await vi.advanceTimersByTimeAsync(7_500); // T0+26500, remaining 500<5000
    await enqueueMatch('u5', 1); // deadline → T0+34500

    await vi.advanceTimersByTimeAsync(7_500); // T0+34000, remaining 500<5000
    await enqueueMatch('u6', 1); // deadline → T0+42000

    await vi.advanceTimersByTimeAsync(7_500); // T0+41500, remaining 500<5000
    mockedEmitToUser.mockClear();
    await enqueueMatch('u7', 1); // 요청상 다음 deadline은 T0+49500이지만 하드 캡(T0+45000)으로 clamp

    expect(mockedEmitToUser).toHaveBeenCalledWith('u7', SERVER_EVENT.MATCH_UPDATE, {
      mode: 1,
      count: 7,
      min: 3,
      max: 12,
      deadline: T0 + 45_000,
    });

    await vi.advanceTimersByTimeAsync(3_500); // T0+45000 — 하드 캡 도달, 확정
    expect(mockedCreateRoom).toHaveBeenCalledOnce();
    expect(mockedCreateRoom).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'] })
    );
  });

  it('MATCH-06: 최대 인원(12명) 도달 시 카운트다운 없이 즉시 매칭한다', async () => {
    for (let i = 1; i <= 12; i++) {
      await enqueueMatch(`u${i}`, 2);
    }

    expect(mockedCreateRoom).toHaveBeenCalledOnce();
    expect(mockedCreateRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 2,
        userIds: Array.from({ length: 12 }, (_, i) => `u${i + 1}`),
      })
    );
  });

  it('MATCH-07: dequeueMatch는 1/2 모드 전부에서 ZREM하고, 최소 인원 미달이면 카운트다운을 취소한다', async () => {
    await enqueueMatch('u1', 1);
    await enqueueMatch('u2', 1);
    await enqueueMatch('u3', 1); // 카운트다운 시작됨

    mockedEmitToUser.mockClear();
    await dequeueMatch('u1');

    expect(redis.zrem).toHaveBeenCalledWith('matchlobby:1:members', 'u1');
    expect(redis.zrem).toHaveBeenCalledWith('matchlobby:2:members', 'u1');
    (['u2', 'u3'] as const).forEach((id) => {
      expect(mockedEmitToUser).toHaveBeenCalledWith(id, SERVER_EVENT.MATCH_UPDATE, {
        mode: 1,
        count: 2,
        min: 3,
        max: 12,
        deadline: null,
      });
    });

    // 취소된 카운트다운 타이머가 더 이상 돌지 않는지 — 20초를 흘려보내도 방 생성 안 됨
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mockedCreateRoom).not.toHaveBeenCalled();
  });
});
