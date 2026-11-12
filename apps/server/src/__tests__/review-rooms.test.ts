import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { RoomState } from '@sketch-catch/shared';

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('../middleware/authenticate.js', () => ({
  authenticate: async (req: { userId?: string; headers: { 'x-test-user'?: string } }) => {
    req.userId = req.headers['x-test-user'];
  },
}));
vi.mock('../db/redis.js', () => ({
  redis: {
    get: vi.fn(async (key: string) => storage.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (...keys: string[]) => {
      for (const key of keys) storage.delete(key);
    }),
    zadd: vi.fn(),
    zrem: vi.fn(),
  },
  setPresence: vi.fn(),
  setUserRoom: vi.fn(),
  getUserRoom: vi.fn(),
}));
vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async () => ({
        nickname: '심사자',
        characterId: 'duck',
        friendCode: 'TEST1',
        frameId: null,
        backgroundId: null,
        chatColorId: null,
        statusMessage: null,
      })),
    },
    userBlock: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock('../socket/presence.namespace.js', () => ({ broadcastPresenceUpdate: vi.fn() }));

const { env } = await import('../lib/env.js');
const { redis } = await import('../db/redis.js');
const { roomsRoutes } = await import('../routes/rooms.js');
const { canUseReviewRoom } = await import('../services/reviewRooms.js');
const originalReviewers = env.REVIEW_USER_IDS;
const apps: ReturnType<typeof Fastify>[] = [];
const input = { mode: 1, review: true, playerCountMax: 8, roundCount: 5, drawTimer: 60, categories: ['FOOD'] };

async function app() {
  const instance = Fastify();
  apps.push(instance);
  await instance.register(roomsRoutes);
  return instance;
}

describe('심사 체험방 접근·생성', () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
    env.REVIEW_USER_IDS = ['reviewer'];
  });
  afterEach(async () => {
    env.REVIEW_USER_IDS = originalReviewers;
    await Promise.all(apps.splice(0).map(instance => instance.close()));
  });

  it('허용 목록이 비어 있으면 누구도 체험방을 만들 수 없다', () => {
    env.REVIEW_USER_IDS = [];
    expect(canUseReviewRoom('reviewer')).toBe(false);
  });

  it('일반 계정의 review 플래그 위조를 거부한다', async () => {
    const response = await (
      await app()
    ).inject({ method: 'POST', url: '/rooms', headers: { 'x-test-user': 'other' }, payload: input });
    expect(response.statusCode).toBe(403);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it.each([1, 2])('허용 계정의 모드 %s 체험방에는 준비된 봇 2명만 추가한다', async mode => {
    const response = await (
      await app()
    ).inject({ method: 'POST', url: '/rooms', headers: { 'x-test-user': 'reviewer' }, payload: { ...input, mode } });
    expect(response.statusCode).toBe(201);
    const state = JSON.parse(storage.get(`room:${response.json().code}:state`)!) as RoomState;
    expect(state.reviewOwnerId).toBe('reviewer');
    expect(state.players).toHaveLength(3);
    expect(state.players.filter(p => p.isBot)).toHaveLength(2);
    expect(state.players.filter(p => p.isBot).every(p => p.isReady)).toBe(true);
    expect(state.config).toMatchObject({ playerCountMax: 3, roundCount: 1, categories: ['ANIMAL'] });
    expect(redis.zadd).not.toHaveBeenCalled();
  });

  it('일반 방 생성에는 봇과 체험방 속성을 넣지 않는다', async () => {
    const response = await (
      await app()
    ).inject({
      method: 'POST',
      url: '/rooms',
      headers: { 'x-test-user': 'other' },
      payload: { ...input, review: false },
    });
    expect(response.statusCode).toBe(201);
    const state = JSON.parse(storage.get(`room:${response.json().code}:state`)!) as RoomState;
    expect(state.reviewOwnerId).toBeUndefined();
    expect(state.players).toHaveLength(1);
    expect(redis.zadd).toHaveBeenCalled();
  });

  it('다른 계정의 체험방 조회·초대 미리보기를 차단하고 설정 변경을 막는다', async () => {
    const instance = await app();
    const created = await instance.inject({
      method: 'POST',
      url: '/rooms',
      headers: { 'x-test-user': 'reviewer' },
      payload: input,
    });
    const code = created.json().code;
    for (const suffix of ['', '/preview']) {
      const response = await instance.inject({ url: `/rooms/${code}${suffix}`, headers: { 'x-test-user': 'other' } });
      expect(response.statusCode).toBe(404);
    }
    const patched = await instance.inject({
      method: 'PATCH',
      url: `/rooms/${code}`,
      headers: { 'x-test-user': 'reviewer' },
      payload: { playerCountMax: 12 },
    });
    expect(patched.statusCode).toBe(403);
  });
});
