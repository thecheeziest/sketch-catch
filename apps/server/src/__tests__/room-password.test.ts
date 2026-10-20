import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { RoomState } from '@sketch-catch/shared';

vi.mock('../db/prisma.js', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

vi.mock('../db/redis.js', () => ({
  redis: { get: vi.fn(), set: vi.fn().mockResolvedValue('OK'), del: vi.fn() },
  setPresence: vi.fn().mockResolvedValue(undefined),
  setUserRoom: vi.fn().mockResolvedValue(undefined),
  getPresence: vi.fn().mockResolvedValue('OFFLINE'),
}));

vi.mock('../services/rooms.service.js', () => ({
  createRoom: vi.fn(),
  getRoomState: vi.fn(),
  saveRoomState: vi.fn().mockResolvedValue(undefined),
  assertJoinable: vi.fn(),
  getRoomPassword: vi.fn(),
  setRoomPassword: vi.fn().mockResolvedValue(undefined),
  clearRoomPassword: vi.fn().mockResolvedValue(undefined),
  RoomFullError: class extends Error {},
  RoomLockedError: class extends Error {},
  WrongPasswordError: class extends Error {},
}));

vi.mock('../socket/presence.namespace.js', () => ({ broadcastPresenceUpdate: vi.fn() }));

const { prisma } = await import('../db/prisma.js');
const { redis } = await import('../db/redis.js');
const { createRoom, getRoomState, saveRoomState, getRoomPassword, setRoomPassword, clearRoomPassword } = await import(
  '../services/rooms.service.js'
);
const { signTokens } = await import('../auth/jwt.js');
const { roomsRoutes } = await import('../routes/rooms.js');

async function buildApp() {
  const app = Fastify();
  app.decorate('io', { of: () => ({ to: () => ({ emit: vi.fn() }) }) } as never);
  await app.register(roomsRoutes);
  return app;
}

async function authHeader(userId = 'u1') {
  const { accessToken } = await signTokens(userId);
  vi.mocked(redis.get).mockResolvedValue(accessToken);
  return { authorization: `Bearer ${accessToken}` };
}

const baseCreateInput = {
  mode: 1 as const,
  playerCountMax: 6,
  roundCount: 1,
  drawTimer: 40,
  categories: ['ANIMAL'],
};

function makeLobby(overrides: Partial<RoomState> = {}): RoomState {
  return {
    code: 'ABC123',
    hostId: 'u1',
    mode: 1,
    status: 'LOBBY',
    players: [],
    config: { roundCount: 3, drawTimer: 60, answerTimer: 10, categories: ['ANIMAL'], playerCountMax: 6 },
    scoreboard: {},
    current: null,
    ...overrides,
  } as RoomState;
}

describe('방 비밀번호', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1', nickname: '호스트' } as never);
    vi.mocked(createRoom).mockResolvedValue(makeLobby());
  });

  it('POST /rooms: 잠금 방을 비밀번호 없이 만들면 400', async () => {
    const headers = await authHeader();
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/rooms', headers, payload: { ...baseCreateInput, locked: true } });

    expect(res.statusCode).toBe(400);
    expect(createRoom).not.toHaveBeenCalled();
  });

  it('POST /rooms: 공백만 있는 비밀번호는 400', async () => {
    const headers = await authHeader();
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers,
      payload: { ...baseCreateInput, locked: true, password: '   ' },
    });

    expect(res.statusCode).toBe(400);
    expect(createRoom).not.toHaveBeenCalled();
  });

  it('POST /rooms: 잠금 방은 앞뒤 공백을 뺀 비밀번호로 만든다', async () => {
    const headers = await authHeader();
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers,
      payload: { ...baseCreateInput, locked: true, password: ' 1234 ' },
    });

    expect(res.statusCode).toBe(201);
    expect(vi.mocked(createRoom).mock.calls[0]![0]).toMatchObject({ locked: true, password: '1234' });
  });

  it('PATCH: 공개 방을 비밀번호 없이 잠그면 400, 상태는 그대로', async () => {
    const headers = await authHeader();
    const state = makeLobby({ locked: false });
    vi.mocked(getRoomState).mockResolvedValue(state);
    vi.mocked(getRoomPassword).mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/rooms/ABC123', headers, payload: { locked: true } });

    expect(res.statusCode).toBe(400);
    expect(state.locked).toBe(false);
    expect(saveRoomState).not.toHaveBeenCalled();
  });

  it('PATCH: 공개 방을 비밀번호와 함께 잠근다', async () => {
    const headers = await authHeader();
    const state = makeLobby({ locked: false });
    vi.mocked(getRoomState).mockResolvedValue(state);
    const app = await buildApp();

    const res = await app.inject({
      method: 'PATCH',
      url: '/rooms/ABC123',
      headers,
      payload: { locked: true, password: '1234' },
    });

    expect(res.statusCode).toBe(200);
    expect(state.locked).toBe(true);
    expect(setRoomPassword).toHaveBeenCalledWith('ABC123', '1234');
  });

  it('PATCH: 이미 잠긴 방은 비밀번호를 비워 두면 기존 비밀번호를 유지한다', async () => {
    const headers = await authHeader();
    vi.mocked(getRoomState).mockResolvedValue(makeLobby({ locked: true }));
    vi.mocked(getRoomPassword).mockResolvedValue('1234');
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/rooms/ABC123', headers, payload: { locked: true, title: '새 제목' } });

    expect(res.statusCode).toBe(200);
    expect(setRoomPassword).not.toHaveBeenCalled();
    expect(clearRoomPassword).not.toHaveBeenCalled();
  });

  it('PATCH: 잠금을 풀면 비밀번호를 지운다', async () => {
    const headers = await authHeader();
    const state = makeLobby({ locked: true });
    vi.mocked(getRoomState).mockResolvedValue(state);
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/rooms/ABC123', headers, payload: { locked: false } });

    expect(res.statusCode).toBe(200);
    expect(state.locked).toBe(false);
    expect(clearRoomPassword).toHaveBeenCalledWith('ABC123');
  });
});
