import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    friendship: { findUnique: vi.fn() },
  },
}));

vi.mock('../db/redis.js', () => ({
  redis: { get: vi.fn(), set: vi.fn().mockResolvedValue('OK'), del: vi.fn() },
  setPresence: vi.fn().mockResolvedValue(undefined),
  getPresence: vi.fn().mockResolvedValue('OFFLINE'),
}));

vi.mock('../services/rooms.service.js', () => ({
  getRoomState: vi.fn(),
}));

vi.mock('../services/push.service.js', () => ({
  sendPush: vi.fn().mockResolvedValue(undefined),
  shouldSend: vi.fn().mockResolvedValue(true),
}));

const { prisma } = await import('../db/prisma.js');
const { redis } = await import('../db/redis.js');
const { getRoomState } = await import('../services/rooms.service.js');
const { sendPush, shouldSend } = await import('../services/push.service.js');
const { signTokens } = await import('../auth/jwt.js');
const { invitesRoutes } = await import('../routes/invites.js');

async function buildApp() {
  const app = Fastify();
  await app.register(invitesRoutes);
  return app;
}

async function authHeader(userId = 'u1') {
  const { accessToken } = await signTokens(userId);
  vi.mocked(redis.get).mockResolvedValue(accessToken);
  return { authorization: `Bearer ${accessToken}` };
}

const lobbyRoom = { code: 'ABC123', status: 'LOBBY', title: '테스트 방', players: [{ id: 'u1' }] } as any;
const inGameRoom = { code: 'ABC123', status: 'MODE1_ROUND_START' } as any;

describe('POST /rooms/:code/invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.friendship.findUnique).mockResolvedValue({ id: 'fs1' } as any);
    vi.mocked(shouldSend).mockResolvedValue(true);
  });

  it('LOBBY 방 + 유효 target → sendPush 호출 (data.roomCode 포함), ok:true (PUSH-03)', async () => {
    const headers = await authHeader();
    vi.mocked(getRoomState).mockResolvedValue(lobbyRoom);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ pushToken: 'ExponentPushToken[xxx]' } as any) // target lookup
      .mockResolvedValueOnce({ nickname: '초대자' } as any); // inviter nickname lookup

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/rooms/ABC123/invite',
      headers,
      payload: { target: 'u2' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(sendPush).toHaveBeenCalledWith(
      ['ExponentPushToken[xxx]'],
      expect.objectContaining({ data: { type: 'GAME_INVITE', roomCode: 'ABC123', roomTitle: '테스트 방' } })
    );
  });

  it('LOBBY 아닌 방 → 403 GAME_IN_PROGRESS, sendPush 미호출 (D-12)', async () => {
    const headers = await authHeader();
    vi.mocked(getRoomState).mockResolvedValue(inGameRoom);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/rooms/ABC123/invite',
      headers,
      payload: { target: 'u2' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'GAME_IN_PROGRESS' });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('유효하지 않은 방 코드 → 400 INVALID_CODE', async () => {
    const headers = await authHeader();
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/rooms/bad-code/invite',
      headers,
      payload: { target: 'u2' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'INVALID_CODE' });
  });

  it('존재하지 않는 방 → 404 ROOM_NOT_FOUND', async () => {
    const headers = await authHeader();
    vi.mocked(getRoomState).mockResolvedValue(null);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/rooms/ABC123/invite',
      headers,
      payload: { target: 'u2' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'ROOM_NOT_FOUND' });
  });

  it('존재하지 않는 target userId → 404 USER_NOT_FOUND', async () => {
    const headers = await authHeader();
    vi.mocked(getRoomState).mockResolvedValue(lobbyRoom);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/rooms/ABC123/invite',
      headers,
      payload: { target: 'u2' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'USER_NOT_FOUND' });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('target의 pushToken이 null이면 발송 없이 ok:true', async () => {
    const headers = await authHeader();
    vi.mocked(getRoomState).mockResolvedValue(lobbyRoom);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ pushToken: null } as any);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/rooms/ABC123/invite',
      headers,
      payload: { target: 'u2' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('body에 target 누락 → 400 INVALID_INPUT', async () => {
    const headers = await authHeader();
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/rooms/ABC123/invite',
      headers,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'INVALID_INPUT' });
  });

  it('방에 없는 유저의 초대 → 403 NOT_IN_ROOM', async () => {
    const headers = await authHeader('u9');
    vi.mocked(getRoomState).mockResolvedValue(lobbyRoom);

    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/rooms/ABC123/invite', headers, payload: { target: 'u2' } });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'NOT_IN_ROOM' });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('친구가 아닌 대상 → 403 NOT_FRIENDS', async () => {
    const headers = await authHeader();
    vi.mocked(getRoomState).mockResolvedValue(lobbyRoom);
    vi.mocked(prisma.friendship.findUnique).mockResolvedValue(null);

    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/rooms/ABC123/invite', headers, payload: { target: 'u2' } });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'NOT_FRIENDS' });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('쿨다운 중 재초대 → 429 INVITE_COOLDOWN, sendPush 미호출 (30초 TTL)', async () => {
    const headers = await authHeader();
    vi.mocked(getRoomState).mockResolvedValue(lobbyRoom);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ pushToken: 'ExponentPushToken[xxx]' } as any);
    vi.mocked(shouldSend).mockResolvedValue(false);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/rooms/ABC123/invite',
      headers,
      payload: { target: 'u2' },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({ error: 'INVITE_COOLDOWN' });
    expect(shouldSend).toHaveBeenCalledWith('game-invite:u1:u2:ABC123', 30);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('Authorization 헤더 없으면 401', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/rooms/ABC123/invite',
      payload: { target: 'u2' },
    });
    expect(res.statusCode).toBe(401);
  });
});
