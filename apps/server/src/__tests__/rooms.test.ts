import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RoomState } from '@sketch-catch/shared';

const mockRedisSet = vi.fn().mockResolvedValue('OK');
const mockRedisGet = vi.fn();

vi.mock('../db/redis.js', () => ({
  redis: { set: mockRedisSet, get: mockRedisGet, del: vi.fn() },
  setPresence: vi.fn(),
  getPresence: vi.fn(),
}));

const { createRoom, getRoomState } = await import('../services/rooms.service.js');

const baseConfig = {
  roundCount: 5,
  drawTimer: 30,
  answerTimer: 10,
  categories: ['ANIMAL' as const],
  playerCountMax: 4,
};

const baseUserMeta = {
  'user-1': { nickname: '테스터', characterId: 'cat' },
};

describe('rooms.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
  });

  // ROOM-01: createRoom
  it('ROOM-01: createRoom이 6자리 영문대문자/숫자 코드를 발급한다', async () => {
    const state = await createRoom({
      hostId: 'user-1',
      userIds: ['user-1'],
      config: baseConfig,
      locked: false,
      mode: 1,
      userMeta: baseUserMeta,
    });

    expect(state.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(mockRedisSet).toHaveBeenCalledWith(
      `room:${state.code}:state`,
      expect.any(String),
      'EX',
      7200
    );
  });

  it('ROOM-01: createRoom이 title/locked/config를 RoomState에 반영한다', async () => {
    const state = await createRoom({
      hostId: 'user-1',
      userIds: ['user-1'],
      config: baseConfig,
      title: '우리 방',
      locked: true,
      mode: 1,
      userMeta: baseUserMeta,
    });

    expect(state.title).toBe('우리 방');
    expect(state.locked).toBe(true);
    expect(state.config).toEqual(baseConfig);
    expect(state.status).toBe('LOBBY');
    expect(state.players[0]?.isHost).toBe(true);
    expect(state.players[0]?.isReady).toBe(false);
    expect(state.players[0]?.connected).toBe(true);
    expect(state.players[0]?.slot).toBe(0);
  });

  // ROOM-02: getRoomState
  it('ROOM-02: getRoomState가 존재하지 않는 코드에 null 반환', async () => {
    mockRedisGet.mockResolvedValue(null);
    const result = await getRoomState('XXXXXX');
    expect(result).toBeNull();
  });

  it('ROOM-02: getRoomState가 저장된 RoomState를 파싱해 반환', async () => {
    const fakeState: RoomState = {
      code: 'ABC123',
      hostId: 'user-1',
      mode: 1,
      status: 'LOBBY',
      players: [],
      config: baseConfig,
      scoreboard: {},
      current: null,
      title: '테스트방',
      locked: false,
    };
    mockRedisGet.mockResolvedValue(JSON.stringify(fakeState));

    const result = await getRoomState('ABC123');
    expect(result).toEqual(fakeState);
    expect(mockRedisGet).toHaveBeenCalledWith('room:ABC123:state');
  });
});
