import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { createRoomSchema } from '@sketch-catch/shared';
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
  RoomFullError: class extends Error {},
  RoomLockedError: class extends Error {},
  WrongPasswordError: class extends Error {},
}));

vi.mock('../socket/presence.namespace.js', () => ({ broadcastPresenceUpdate: vi.fn() }));

const { prisma } = await import('../db/prisma.js');
const { redis } = await import('../db/redis.js');
const { createRoom, getRoomState, saveRoomState } = await import('../services/rooms.service.js');
const { signTokens } = await import('../auth/jwt.js');
const { roomsRoutes } = await import('../routes/rooms.js');
const { judgePenaltyLosers, isPenaltyTextClean } = await import('../services/penalty.js');

async function buildApp() {
  const app = Fastify();
  const emit = vi.fn();
  app.decorate('io', { of: () => ({ to: () => ({ emit }) }) } as never);
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

const ranking = (scores: Record<string, number>) =>
  Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .map(([userId, score]) => ({ userId, score }));

describe('judgePenaltyLosers', () => {
  const none = new Set<string>();

  it('최하위 1명을 고른다', () => {
    const losers = judgePenaltyLosers(ranking({ a: 900, b: 500, c: 100 }), { loserCount: 1, text: '커피' }, none);
    expect(losers).toEqual(['c']);
  });

  it('꼴찌 2명이면 하위 2명을 고른다', () => {
    const losers = judgePenaltyLosers(
      ranking({ a: 900, b: 500, c: 300, d: 100 }),
      { loserCount: 2, text: '커피' },
      none,
    );
    expect(losers.sort()).toEqual(['c', 'd']);
  });

  it('꼴찌 경계 점수와 동점이면 모두 걸린다', () => {
    const losers = judgePenaltyLosers(
      ranking({ a: 900, b: 100, c: 100, d: 100 }),
      { loserCount: 1, text: '커피' },
      none,
    );
    expect(losers.sort()).toEqual(['b', 'c', 'd']);
  });

  it('전원 동점이면 전원이 걸린다', () => {
    const losers = judgePenaltyLosers(ranking({ a: 0, b: 0, c: 0 }), { loserCount: 1, text: '커피' }, none);
    expect(losers.sort()).toEqual(['a', 'b', 'c']);
  });

  it('게임 중 나간 사람은 판정에서 빠진다', () => {
    const losers = judgePenaltyLosers(
      ranking({ a: 900, b: 500, c: 300, d: 0 }),
      { loserCount: 1, text: '커피' },
      new Set(['d']),
    );
    expect(losers).toEqual(['c']);
  });

  it('인원이 줄어 꼴찌 수가 남은 인원 이상이면 최소 1명은 단상에 남긴다', () => {
    const losers = judgePenaltyLosers(
      ranking({ a: 900, b: 500, c: 300, d: 0 }),
      { loserCount: 2, text: '커피' },
      new Set(['c', 'd']),
    );
    expect(losers).toEqual(['b']);
  });
});

describe('createRoomSchema penalty', () => {
  it('모드 1 + 유효한 벌칙은 통과하고 내용 앞뒤 공백을 지운다', () => {
    const parsed = createRoomSchema.safeParse({ ...baseCreateInput, penalty: { loserCount: 1, text: ' 커피 쏘기 ' } });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.penalty?.text).toBe('커피 쏘기');
  });

  it('모드 2에서는 벌칙을 거부한다', () => {
    const parsed = createRoomSchema.safeParse({
      ...baseCreateInput,
      mode: 2,
      penalty: { loserCount: 1, text: '커피' },
    });
    expect(parsed.success).toBe(false);
  });

  it('공백뿐인 내용·20자 초과 내용을 거부한다', () => {
    expect(createRoomSchema.safeParse({ ...baseCreateInput, penalty: { loserCount: 1, text: '   ' } }).success).toBe(
      false,
    );
    expect(
      createRoomSchema.safeParse({ ...baseCreateInput, penalty: { loserCount: 1, text: '가'.repeat(21) } }).success,
    ).toBe(false);
  });

  it('꼴찌 2명은 최대 인원 4명 이상부터 허용한다', () => {
    const three = { ...baseCreateInput, playerCountMax: 3, penalty: { loserCount: 2, text: '커피' } };
    expect(createRoomSchema.safeParse(three).success).toBe(false);
    expect(createRoomSchema.safeParse({ ...three, playerCountMax: 4 }).success).toBe(true);
  });

  it('벌칙 인원은 최대 인원 - 2까지 허용한다', () => {
    const twelve = { ...baseCreateInput, playerCountMax: 12, penalty: { loserCount: 10, text: '커피' } };
    expect(createRoomSchema.safeParse(twelve).success).toBe(true);
    expect(createRoomSchema.safeParse({ ...twelve, playerCountMax: 11 }).success).toBe(false);
  });

  it('벌칙 인원은 1~10명만 허용한다', () => {
    const input = { ...baseCreateInput, playerCountMax: 12 };
    expect(createRoomSchema.safeParse({ ...input, penalty: { loserCount: 0, text: '커피' } }).success).toBe(false);
    expect(createRoomSchema.safeParse({ ...input, penalty: { loserCount: 11, text: '커피' } }).success).toBe(false);
  });
});

describe('isPenaltyTextClean', () => {
  it('비속어가 섞이면 false', () => {
    expect(isPenaltyTextClean('테스트욕설 하기')).toBe(false);
  });

  it('정상 문구는 true', () => {
    expect(isPenaltyTextClean('아이스크림 쏘기')).toBe(true);
  });
});

describe('벌칙 방 REST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saveRoomState).mockResolvedValue(undefined);
  });

  it('POST /rooms: 벌칙을 config에 담아 방을 만든다', async () => {
    const headers = await authHeader();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ nickname: '방장', characterId: 'cat', friendCode: 'AAAAA' } as never);
    vi.mocked(createRoom).mockResolvedValue({ code: 'ABC123' } as RoomState);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers,
      payload: { ...baseCreateInput, penalty: { loserCount: 1, text: '커피 쏘기' } },
    });

    expect(res.statusCode).toBe(201);
    expect(vi.mocked(createRoom).mock.calls[0]![0].config.penalty).toEqual({ loserCount: 1, text: '커피 쏘기' });
  });

  it('POST /rooms: 비속어 벌칙은 400 PROFANE_PENALTY', async () => {
    const headers = await authHeader();
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers,
      payload: { ...baseCreateInput, penalty: { loserCount: 1, text: '테스트욕설' } },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'PROFANE_PENALTY' });
    expect(createRoom).not.toHaveBeenCalled();
  });

  it('PATCH: 벌칙을 켜고 null로 끈다', async () => {
    const headers = await authHeader();
    const state = makeLobby();
    vi.mocked(getRoomState).mockResolvedValue(state);
    const app = await buildApp();

    const on = await app.inject({
      method: 'PATCH',
      url: '/rooms/ABC123',
      headers,
      payload: { penalty: { loserCount: 2, text: '노래 한 곡' } },
    });
    expect(on.statusCode).toBe(200);
    expect(state.config.penalty).toEqual({ loserCount: 2, text: '노래 한 곡' });

    const off = await app.inject({ method: 'PATCH', url: '/rooms/ABC123', headers, payload: { penalty: null } });
    expect(off.statusCode).toBe(200);
    expect(state.config.penalty).toBeUndefined();
  });

  it('PATCH: 모드 2 방에는 벌칙을 켤 수 없다', async () => {
    const headers = await authHeader();
    vi.mocked(getRoomState).mockResolvedValue(makeLobby({ mode: 2 }));
    const app = await buildApp();

    const res = await app.inject({
      method: 'PATCH',
      url: '/rooms/ABC123',
      headers,
      payload: { penalty: { loserCount: 1, text: '커피' } },
    });
    expect(res.statusCode).toBe(400);
    expect(saveRoomState).not.toHaveBeenCalled();
  });

  it('PATCH: 인원을 3명으로 줄이면서 꼴찌 2명을 유지하면 400, 상태는 그대로', async () => {
    const headers = await authHeader();
    const state = makeLobby();
    state.config.penalty = { loserCount: 2, text: '커피' };
    vi.mocked(getRoomState).mockResolvedValue(state);
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/rooms/ABC123', headers, payload: { playerCountMax: 3 } });
    expect(res.statusCode).toBe(400);
    expect(state.config.playerCountMax).toBe(6);
  });

  it('PATCH: 비속어 벌칙은 400 PROFANE_PENALTY', async () => {
    const headers = await authHeader();
    vi.mocked(getRoomState).mockResolvedValue(makeLobby());
    const app = await buildApp();

    const res = await app.inject({
      method: 'PATCH',
      url: '/rooms/ABC123',
      headers,
      payload: { penalty: { loserCount: 1, text: '테스트욕설' } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'PROFANE_PENALTY' });
  });
});
