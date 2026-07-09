import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enqueueMatch, dequeueMatch } from '../services/match.service.js';

vi.mock('../db/redis.js', () => ({
  redis: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    zadd: vi.fn().mockResolvedValue(1),
    zcount: vi.fn().mockResolvedValue(0),
    zpopmin: vi.fn().mockResolvedValue([]),
    zrem: vi.fn().mockResolvedValue(1),
  },
  setPresence: vi.fn(),
  setUserRoom: vi.fn(),
  getPresence: vi.fn(),
}));

vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'u1', nickname: 'Alice', characterId: 'CAT_01', friendCode: 'A1B2C' },
        { id: 'u2', nickname: 'Bob',   characterId: 'DOG_01', friendCode: 'B2C3D' },
        { id: 'u3', nickname: 'Carol', characterId: 'CAT_02', friendCode: 'C3D4E' },
        { id: 'u4', nickname: 'Dave',  characterId: 'DOG_02', friendCode: 'D4E5F' },
        { id: 'u5', nickname: 'Eve',   characterId: 'CAT_03', friendCode: 'E5F6G' },
        { id: 'u6', nickname: 'Frank', characterId: 'DOG_03', friendCode: 'F6G7H' },
      ]),
    },
  },
}));

vi.mock('../services/rooms.service.js', () => ({
  createRoom: vi.fn().mockResolvedValue({ code: 'ABC123', hostId: 'u1', status: 'LOBBY', players: [] }),
}));

import { redis, setPresence, setUserRoom } from '../db/redis.js';
import { createRoom } from '../services/rooms.service.js';

const mockedZadd    = vi.mocked(redis.zadd);
const mockedZcount  = vi.mocked(redis.zcount);
const mockedZpopmin = vi.mocked(redis.zpopmin);
const mockedZrem    = vi.mocked(redis.zrem);
const mockedCreateRoom = vi.mocked(createRoom);

beforeEach(() => {
  vi.clearAllMocks();
  mockedZadd.mockResolvedValue(1);
  mockedZrem.mockResolvedValue(1);
  mockedCreateRoom.mockResolvedValue({ code: 'ABC123', hostId: 'u1', mode: 1, status: 'LOBBY', players: [], config: { roundCount: 5, drawTimer: 30, answerTimer: 10, categories: ['ANIMAL'], playerCountMax: 6 }, scoreboard: {}, current: null });
});

describe('match.service', () => {
  // ROOM-03: enqueueMatch
  it('ROOM-03: enqueueMatch가 matchqueue:1:{count} ZSET에 userId를 ZADD한다', async () => {
    mockedZcount.mockResolvedValue(0); // 인원 부족 → 방 생성 없음
    await enqueueMatch('u1', 6);
    expect(mockedZadd).toHaveBeenCalledWith('matchqueue:1:6', expect.any(Number), 'u1');
  });

  it('ROOM-03: 인원 충족 시 ZPOPMIN으로 정확히 playerCount명 pop 후 방 생성', async () => {
    // zcount >= playerCount 시뮬레이션
    mockedZcount.mockResolvedValue(6);
    // zpopmin이 6명 반환 (member, score 교대)
    mockedZpopmin.mockResolvedValue(['u1', '1000', 'u2', '1001', 'u3', '1002', 'u4', '1003', 'u5', '1004', 'u6', '1005']);

    const result = await enqueueMatch('u1', 6);

    expect(mockedZpopmin).toHaveBeenCalledWith('matchqueue:1:6', 6);
    expect(mockedCreateRoom).toHaveBeenCalledOnce();
    expect(result).toEqual({ code: 'ABC123', userIds: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'] });
    expect(setPresence).toHaveBeenCalledWith('u1', 'IN_LOBBY');
    expect(setPresence).toHaveBeenCalledWith('u6', 'IN_LOBBY');
    expect(setUserRoom).toHaveBeenCalledWith('u1', 'ABC123');
    expect(setUserRoom).toHaveBeenCalledWith('u6', 'ABC123');
  });

  it('ROOM-03: pop 결과가 playerCount 미만이면 다시 ZADD (레이스 컨디션 방어 — Pitfall 7)', async () => {
    mockedZcount.mockResolvedValue(6);
    // zpopmin이 4명만 반환 (레이스 컨디션 — 다른 프로세스가 먼저 pop)
    mockedZpopmin.mockResolvedValue(['u1', '1000', 'u2', '1001', 'u3', '1002', 'u4', '1003']);

    const result = await enqueueMatch('u1', 6);

    // 방 생성 안 됨
    expect(mockedCreateRoom).not.toHaveBeenCalled();
    // 꺼낸 유저들 다시 삽입
    expect(mockedZadd).toHaveBeenCalledTimes(2); // 처음 enqueue + 레이스 컨디션 재삽입
    expect(result).toBeNull();
  });

  // ROOM-04: dequeueMatch
  it('ROOM-04: dequeueMatch가 6/8/10 큐 전부에서 ZREM한다', async () => {
    await dequeueMatch('u1');
    expect(mockedZrem).toHaveBeenCalledTimes(3);
    expect(mockedZrem).toHaveBeenCalledWith('matchqueue:1:6', 'u1');
    expect(mockedZrem).toHaveBeenCalledWith('matchqueue:1:8', 'u1');
    expect(mockedZrem).toHaveBeenCalledWith('matchqueue:1:10', 'u1');
  });
});
