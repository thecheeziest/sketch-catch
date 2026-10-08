import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

const redisStore = new Map<string, string>();

vi.mock('../db/redis.js', () => ({
  redis: {
    get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      redisStore.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      redisStore.delete(key);
      return 1;
    }),
  },
  setPresence: vi.fn(async (userId: string, status = 'ONLINE') => {
    redisStore.set(`user:presence:${userId}`, status);
  }),
  getPresence: vi.fn(async (userId: string) => {
    const status = redisStore.get(`user:presence:${userId}`);
    if (status === 'ONLINE' || status === 'IN_LOBBY' || status === 'IN_GAME') return status;
    return 'OFFLINE';
  }),
  setUserRoom: vi.fn(async (userId: string, code: string) => {
    redisStore.set(`user:room:${userId}`, code);
  }),
  getUserRoom: vi.fn(async (userId: string) => redisStore.get(`user:room:${userId}`) ?? null),
  clearUserRoom: vi.fn(async (userId: string) => {
    redisStore.delete(`user:room:${userId}`);
  }),
}));

vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    friendship: { findMany: vi.fn() },
  },
}));

const { redis } = await import('../db/redis.js');
const { prisma } = await import('../db/prisma.js');
const { signTokens } = await import('../auth/jwt.js');
const { roomsRoutes } = await import('../routes/rooms.js');
const { friendsRoutes } = await import('../routes/friends.js');

const userA = {
  id: 'uA',
  provider: 'KAKAO' as const,
  providerId: 'kakao-a',
  nickname: '유저A',
  friendCode: 'AAAAA',
  characterId: 'cat',
  pushToken: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  nicknameChangedAt: null,
};

const userB = {
  ...userA,
  id: 'uB',
  providerId: 'kakao-b',
  nickname: '유저B',
  friendCode: 'BBBBB',
  characterId: 'dog',
};

async function buildApp() {
  const app = Fastify();
  await app.register(roomsRoutes);
  await app.register(friendsRoutes);
  return app;
}

describe('presence flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisStore.clear();
    vi.mocked(prisma.user.findUnique).mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === 'uA') return userA as never;
      if (where.id === 'uB') return userB as never;
      return null;
    });
    vi.mocked(prisma.friendship.findMany).mockResolvedValue([
      {
        id: 'friendship-1',
        userAId: 'uA',
        userBId: 'uB',
        userA,
        userB,
      },
    ] as never);
  });

  it('POST /rooms 직후 친구 GET /friends에서 IN_LOBBY와 room 정보를 반환한다', async () => {
    const app = await buildApp();
    const { accessToken: tokenA } = await signTokens('uA');
    const { accessToken: tokenB } = await signTokens('uB');
    await redis.set('session:uA', tokenA);
    await redis.set('session:uB', tokenB);

    const createRes = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        mode: 1,
        playerCountMax: 6,
        roundCount: 5,
        drawTimer: 30,
        categories: ['CUSTOM'],
        locked: false,
      },
    });

    expect(createRes.statusCode).toBe(201);
    expect(redisStore.get('user:presence:uA')).toBe('IN_LOBBY');

    const friendsRes = await app.inject({
      method: 'GET',
      url: '/friends',
      headers: { authorization: `Bearer ${tokenB}` },
    });

    expect(friendsRes.statusCode).toBe(200);
    expect(friendsRes.json()).toEqual([
      expect.objectContaining({
        userId: 'uA',
        presenceStatus: 'IN_LOBBY',
        room: expect.objectContaining({
          code: createRes.json().code,
          playerCount: 1,
          playerCountMax: 6,
          joinable: true,
        }),
      }),
    ]);
  });

  it('남아 있는 게임 상태와 삭제된 방을 재접속·친구 조회에서 온라인으로 복구한다', async () => {
    const app = await buildApp();
    const { accessToken } = await signTokens('uB');
    await redis.set('session:uB', accessToken);
    redisStore.set('user:presence:uA', 'IN_GAME');
    redisStore.set('user:room:uA', 'OLD111');
    redisStore.set('user:presence:uB', 'IN_GAME');
    redisStore.set('user:room:uB', 'OLD222');
    const response = await app.inject({
      method: 'GET',
      url: '/friends',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([expect.objectContaining({ userId: 'uA', presenceStatus: 'ONLINE' })]);
    expect(redisStore.get('user:presence:uB')).toBe('ONLINE');
    expect(redisStore.has('user:room:uB')).toBe(false);
  });
});
