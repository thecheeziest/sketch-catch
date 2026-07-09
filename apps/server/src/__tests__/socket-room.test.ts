import { describe, it, vi, expect, beforeEach } from 'vitest';
import { handleRoomJoin, handleRoomReady, handleRoomStart, handleRoomLeave } from '../socket/handlers/room.js';
import { SERVER_EVENT } from '@sketch-catch/shared';
import type { RoomState } from '@sketch-catch/shared';

vi.mock('../socket/handlers/game.js', () => ({
  startRound: vi.fn(),
  initTurnSchedule: vi.fn(),
  handlePlayerLeft: vi.fn(),
}));

// Redis mock
vi.mock('../db/redis.js', () => ({
  redis: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
  setPresence: vi.fn(),
  getPresence: vi.fn(),
  setUserRoom: vi.fn(),
  clearUserRoom: vi.fn(),
}));

// rooms.service mock
vi.mock('../services/rooms.service.js', () => ({
  getRoomState: vi.fn(),
  saveRoomState: vi.fn(),
}));

import { getRoomState, saveRoomState } from '../services/rooms.service.js';
import { setPresence, redis, clearUserRoom } from '../db/redis.js';

const mockGetRoomState = vi.mocked(getRoomState);
const mockSaveRoomState = vi.mocked(saveRoomState);
const mockSetPresence = vi.mocked(setPresence);
const mockRedisDel = vi.mocked(redis.del);

// 기본 RoomState fixture
function makeRoomState(overrides: Partial<RoomState> = {}): RoomState {
  return {
    code: 'ABC123',
    hostId: 'u1',
    mode: 1,
    status: 'LOBBY',
    players: [
      {
        id: 'u1',
        nickname: '호스트',
        friendCode: 'CODE1',
        characterId: 'cat',
        slot: 0,
        isHost: true,
        isReady: false,
        connected: true,
      },
      {
        id: 'u2',
        nickname: '참가자',
        friendCode: 'CODE2',
        characterId: 'dog',
        slot: 1,
        isHost: false,
        isReady: false,
        connected: true,
      },
    ],
    config: {
      roundCount: 5,
      drawTimer: 30,
      answerTimer: 30,
      categories: ['ANIMAL'],
      playerCountMax: 6,
    },
    scoreboard: {},
    current: null,
    title: '테스트 방',
    locked: false,
  } satisfies RoomState & typeof overrides extends RoomState ? RoomState : never as RoomState;
}

// Socket mock factory (매 테스트마다 신선한 mock 생성)
function makeSocket(userId = 'u1', rooms: string[] = ['room:ABC123']) {
  return {
    id: `${userId}-socket`,
    emit: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    rooms: new Set(rooms),
    data: { userId },
  };
}

// Namespace mock factory
function makeNamespace() {
  const broadcastEmit = vi.fn();
  const mock = {
    to: vi.fn(() => ({ emit: broadcastEmit })),
    emit: vi.fn(),
    _broadcastEmit: broadcastEmit,
  };
  return mock;
}

describe('socket room handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveRoomState.mockResolvedValue(undefined);
    mockSetPresence.mockResolvedValue(undefined);
  });

  // LBBY-01: handleRoomJoin
  describe('handleRoomJoin', () => {
    it('LBBY-01: 방을 찾을 수 없으면 ROOM_NOT_FOUND 에러를 소켓에 emit한다', async () => {
      mockGetRoomState.mockResolvedValue(null);
      const socket = makeSocket('u3', []);
      const game = makeNamespace();

      await handleRoomJoin(game as any, socket as any, 'NOROOM');

      expect(socket.emit).toHaveBeenCalledWith(SERVER_EVENT.ERROR, {
        code: 'ROOM_NOT_FOUND',
        message: expect.any(String),
      });
      expect(mockSaveRoomState).not.toHaveBeenCalled();
    });

    it('LBBY-01: 방이 가득 찼으면 ROOM_FULL 에러를 emit한다', async () => {
      const state = makeRoomState();
      // playerCountMax를 현재 players 수로 맞춤
      state.config.playerCountMax = 2;
      mockGetRoomState.mockResolvedValue(state);
      const socket = makeSocket('u3', []);
      const game = makeNamespace();

      await handleRoomJoin(game as any, socket as any, 'ABC123');

      expect(socket.emit).toHaveBeenCalledWith(SERVER_EVENT.ERROR, {
        code: 'ROOM_FULL',
        message: expect.any(String),
      });
    });

    it('LBBY-01: 신규 참가자가 빈 슬롯을 채우고 room:state를 broadcast한다', async () => {
      const state = makeRoomState();
      mockGetRoomState.mockResolvedValue(state);
      const socket = makeSocket('u3', []);
      const game = makeNamespace();

      await handleRoomJoin(game as any, socket as any, 'ABC123');

      // 새 플레이어가 추가됨
      expect(mockSaveRoomState).toHaveBeenCalled();
      const savedState = mockSaveRoomState.mock.calls[0]![0]!;
      expect(savedState.players).toHaveLength(3);
      expect(savedState.players.find((p) => p.id === 'u3')).toBeDefined();

      // room:state broadcast
      expect(game.to).toHaveBeenCalledWith('room:ABC123');
      expect(game._broadcastEmit).toHaveBeenCalledWith(SERVER_EVENT.ROOM_STATE, expect.objectContaining({ code: 'ABC123' }));

      // 대기실 입장 시 presence IN_LOBBY 갱신
      expect(mockSetPresence).toHaveBeenCalledWith('u3', 'IN_LOBBY');
    });
  });

  // LBBY-02: handleRoomReady / handleRoomStart
  describe('handleRoomReady', () => {
    it('LBBY-02: isReady를 업데이트하고 allReady를 서버에서 계산해 broadcast한다', async () => {
      const state = makeRoomState();
      mockGetRoomState.mockResolvedValue(state);
      const socket = makeSocket('u1');
      const game = makeNamespace();

      // u1 준비
      await handleRoomReady(game as any, socket as any, true);

      const savedState = mockSaveRoomState.mock.calls[0]![0]!;
      const u1 = savedState.players.find((p) => p.id === 'u1');
      expect(u1?.isReady).toBe(true);
      // u2는 아직 준비 안 함 → allReady false
      expect(savedState.allReady).toBe(false);

      // room:state broadcast
      expect(game._broadcastEmit).toHaveBeenCalledWith(SERVER_EVENT.ROOM_STATE, expect.objectContaining({ allReady: false }));
    });

    it('LBBY-02: 전원 준비 완료 시 allReady=true', async () => {
      const state = makeRoomState();
      // 이미 u2 준비됨 상태
      state.players[1]!.isReady = true;
      mockGetRoomState.mockResolvedValue(state);
      const socket = makeSocket('u1');
      const game = makeNamespace();

      // u1도 준비 → 전원 준비
      await handleRoomReady(game as any, socket as any, true);

      const savedState = mockSaveRoomState.mock.calls[0]![0]!;
      expect(savedState.allReady).toBe(true);
    });
  });

  describe('handleRoomStart', () => {
    it('LBBY-02: 비방장이 room:start를 요청하면 FORBIDDEN 에러를 emit한다', async () => {
      const state = makeRoomState();
      state.allReady = true;
      mockGetRoomState.mockResolvedValue(state);
      // u2가 요청 (비방장)
      const socket = makeSocket('u2');
      const game = makeNamespace();

      await handleRoomStart(game as any, socket as any);

      expect(socket.emit).toHaveBeenCalledWith(SERVER_EVENT.ERROR, {
        code: 'FORBIDDEN',
        message: expect.any(String),
      });
      expect(mockSaveRoomState).not.toHaveBeenCalled();
    });

    it('LBBY-02: allReady가 false이면 NOT_ALL_READY 에러를 emit한다', async () => {
      const state = makeRoomState();
      state.allReady = false;
      mockGetRoomState.mockResolvedValue(state);
      const socket = makeSocket('u1');
      const game = makeNamespace();

      await handleRoomStart(game as any, socket as any);

      expect(socket.emit).toHaveBeenCalledWith(SERVER_EVENT.ERROR, {
        code: 'NOT_ALL_READY',
        message: expect.any(String),
      });
    });

    it('LBBY-02: 방장 + allReady → startedAt 세팅 후 room:state broadcast', async () => {
      const state = makeRoomState();
      state.allReady = true;
      state.players.forEach((p) => (p.isReady = true));
      mockGetRoomState.mockResolvedValue(state);
      const socket = makeSocket('u1');
      const game = makeNamespace();

      await handleRoomStart(game as any, socket as any);

      const savedState = mockSaveRoomState.mock.calls[0]![0]!;
      expect(savedState.startedAt).toBeTypeOf('number');
      expect(game._broadcastEmit).toHaveBeenCalledWith(
        SERVER_EVENT.ROOM_STATE,
        expect.objectContaining({ startedAt: expect.any(Number) }),
      );
    });
  });

  // LBBY-03: handleRoomLeave
  describe('handleRoomLeave', () => {
    it('LBBY-03: 방장 퇴장 시 slot 최소 참가자(u2)가 hostId를 승계한다', async () => {
      const state = makeRoomState();
      // u1(slot:0)=방장, u2(slot:1)=참가자
      mockGetRoomState.mockResolvedValue(state);
      // u1(방장)이 퇴장
      const socket = makeSocket('u1', ['room:ABC123']);
      const game = makeNamespace();

      await handleRoomLeave(game as any, socket as any);

      const savedState = mockSaveRoomState.mock.calls[0]![0]!;
      // u2가 방장 승계
      expect(savedState.hostId).toBe('u2');
      const u2 = savedState.players.find((p) => p.id === 'u2');
      expect(u2?.isHost).toBe(true);
      // u1은 제거됨
      expect(savedState.players.find((p) => p.id === 'u1')).toBeUndefined();

      // room:state broadcast
      expect(game._broadcastEmit).toHaveBeenCalledWith(SERVER_EVENT.ROOM_STATE, expect.objectContaining({ hostId: 'u2' }));
      // room:player:leave broadcast
      expect(game._broadcastEmit).toHaveBeenCalledWith(SERVER_EVENT.ROOM_PLAYER_LEAVE, { userId: 'u1' });

      // D-15: ONLINE presence 복원
      expect(mockSetPresence).toHaveBeenCalledWith('u1', 'ONLINE');
    });

    it('LBBY-03: 마지막 플레이어 퇴장 시 Redis에서 방 상태 삭제한다', async () => {
      const state = makeRoomState();
      // u1만 남긴 상태
      state.players = [state.players[0]!];
      mockGetRoomState.mockResolvedValue(state);
      const socket = makeSocket('u1', ['room:ABC123']);
      const game = makeNamespace();

      await handleRoomLeave(game as any, socket as any);

      expect(mockRedisDel).toHaveBeenCalledWith('room:ABC123:state');
      // 빈 방에는 saveRoomState 호출 안 함
      expect(mockSaveRoomState).not.toHaveBeenCalled();
    });

    it('같은 유저의 다른 방 소켓이 살아 있으면 stale disconnect를 ONLINE으로 덮지 않는다', async () => {
      const state = makeRoomState();
      mockGetRoomState.mockResolvedValue(state);
      const socket = makeSocket('u1', ['room:ABC123']);
      const game = {
        ...makeNamespace(),
        in: vi.fn(() => ({
          fetchSockets: vi.fn().mockResolvedValue([
            { id: 'u1-active-socket', data: { userId: 'u1' } },
          ]),
        })),
      };

      await handleRoomLeave(game as any, socket as any);

      expect(mockSaveRoomState).not.toHaveBeenCalled();
      expect(clearUserRoom).not.toHaveBeenCalled();
      expect(mockSetPresence).not.toHaveBeenCalledWith('u1', 'ONLINE');
    });
  });
});
