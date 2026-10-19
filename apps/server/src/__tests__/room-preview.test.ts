import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { RoomState } from '@sketch-catch/shared';

vi.mock('../db/prisma.js', () => ({ prisma: { user: { findUnique: vi.fn() } } }));

vi.mock('../db/redis.js', () => ({
  redis: { get: vi.fn(), set: vi.fn().mockResolvedValue('OK'), del: vi.fn() },
  setPresence: vi.fn(),
  getPresence: vi.fn(),
  setUserRoom: vi.fn(),
}));

vi.mock('../services/rooms.service.js', () => ({
  getRoomState: vi.fn(),
  createRoom: vi.fn(),
  saveRoomState: vi.fn(),
  assertJoinable: vi.fn(),
  RoomFullError: class extends Error {},
  RoomLockedError: class extends Error {},
  WrongPasswordError: class extends Error {},
}));

vi.mock('../socket/presence.namespace.js', () => ({ broadcastPresenceUpdate: vi.fn() }));

const { redis } = await import('../db/redis.js');
const { getRoomState } = await import('../services/rooms.service.js');
const { signTokens } = await import('../auth/jwt.js');
const { roomsRoutes } = await import('../routes/rooms.js');

async function buildApp() {
  const app = Fastify();
  await app.register(roomsRoutes);
  return app;
}

async function authHeader(userId = 'u1') {
  const { accessToken } = await signTokens(userId);
  vi.mocked(redis.get).mockResolvedValue(accessToken);
  return { authorization: `Bearer ${accessToken}` };
}

function room(overrides: Partial<RoomState> = {}): RoomState {
  return {
    code: 'ABC123',
    hostId: 'h1',
    mode: 1,
    status: 'LOBBY',
    players: [
      {
        id: 'h1',
        nickname: '감자',
        friendCode: 'CODE0',
        characterId: 'cat',
        slot: 0,
        isHost: true,
        isReady: false,
        connected: true,
      },
    ],
    config: { roundCount: 1, drawTimer: 30, answerTimer: 10, categories: ['ANIMAL'], playerCountMax: 2 },
    scoreboard: {},
    current: null,
    title: '감자님의 방',
    locked: true,
    ...overrides,
  };
}

describe('GET /rooms/:code/preview', () => {
  beforeEach(() => vi.clearAllMocks());

  it('잠긴 방이어도 비밀번호 없이 제목·상태를 돌려준다', async () => {
    const headers = await authHeader();
    vi.mocked(getRoomState).mockResolvedValue(room());

    const res = await (await buildApp()).inject({ method: 'GET', url: '/rooms/ABC123/preview', headers });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ code: 'ABC123', title: '감자님의 방', status: 'LOBBY', full: false });
  });

  it('인원이 꽉 찼으면 full: true', async () => {
    const headers = await authHeader();
    const base = room();
    vi.mocked(getRoomState).mockResolvedValue(
      room({ players: [...base.players, { ...base.players[0], id: 'u2', slot: 1, isHost: false }] }),
    );

    const res = await (await buildApp()).inject({ method: 'GET', url: '/rooms/ABC123/preview', headers });

    expect(res.json()).toMatchObject({ full: true });
  });

  it('방이 없으면 404 ROOM_NOT_FOUND', async () => {
    const headers = await authHeader();
    vi.mocked(getRoomState).mockResolvedValue(null);

    const res = await (await buildApp()).inject({ method: 'GET', url: '/rooms/ABC123/preview', headers });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'ROOM_NOT_FOUND' });
  });

  it('인증이 없으면 401', async () => {
    const res = await (await buildApp()).inject({ method: 'GET', url: '/rooms/ABC123/preview' });
    expect(res.statusCode).toBe(401);
  });
});
