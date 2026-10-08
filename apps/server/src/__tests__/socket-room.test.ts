import { describe, it, vi, expect, beforeEach } from 'vitest';
import { handleRoomJoin, handleRoomReady, handleRoomStart, handleRoomLeave } from '../socket/handlers/room.js';
import { SERVER_EVENT } from '@sketch-catch/shared';
import type { RoomState } from '@sketch-catch/shared';

vi.mock('../socket/handlers/game.js', () => ({
  startRound: vi.fn().mockResolvedValue(true),
  initTurnSchedule: vi.fn(),
  handlePlayerLeft: vi.fn(),
  resendCurrentRound: vi.fn(),
}));

vi.mock('../socket/handlers/mode2.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../socket/handlers/mode2.js')>()),
  startMode2: vi.fn(),
  handleMode2PlayerLeft: vi.fn(),
}));

// Redis mock
vi.mock('../db/redis.js', () => ({
  redis: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
  setPresence: vi.fn(),
  getPresence: vi.fn(),
  setUserRoom: vi.fn(),
  clearUserRoom: vi.fn(),
  getUserRoom: vi.fn().mockResolvedValue(null),
}));

// rooms.service mock
vi.mock('../services/rooms.service.js', () => ({
  getRoomState: vi.fn(),
  saveRoomState: vi.fn(),
  withRoomLock: vi.fn((_code: string, fn: () => unknown) => fn()),
}));

import { getRoomState, saveRoomState } from '../services/rooms.service.js';
import { setPresence, redis, clearUserRoom, getUserRoom } from '../db/redis.js';
import { handlePlayerLeft, startRound } from '../socket/handlers/game.js';
import { handleMode2PlayerLeft } from '../socket/handlers/mode2.js';

const mockGetRoomState = vi.mocked(getRoomState);
const mockSaveRoomState = vi.mocked(saveRoomState);
const mockSetPresence = vi.mocked(setPresence);
const mockRedisDel = vi.mocked(redis.del);
const mockHandlePlayerLeft = vi.mocked(handlePlayerLeft);
const mockHandleMode2PlayerLeft = vi.mocked(handleMode2PlayerLeft);

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
      expect(savedState.players.find(p => p.id === 'u3')).toBeDefined();

      // room:state broadcast
      expect(game.to).toHaveBeenCalledWith('room:ABC123');
      expect(game._broadcastEmit).toHaveBeenCalledWith(
        SERVER_EVENT.ROOM_STATE,
        expect.objectContaining({ code: 'ABC123' }),
      );

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
      const u1 = savedState.players.find(p => p.id === 'u1');
      expect(u1?.isReady).toBe(true);
      // u2는 아직 준비 안 함 → allReady false
      expect(savedState.allReady).toBe(false);

      // room:state broadcast
      expect(game._broadcastEmit).toHaveBeenCalledWith(
        SERVER_EVENT.ROOM_STATE,
        expect.objectContaining({ allReady: false }),
      );
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

    it('LBBY-02: 방장 + allReady → gameId·startedAt 세팅 후 첫 라운드 시작 (room:state는 startRound가 전송)', async () => {
      const state = makeRoomState();
      state.players.push({ ...state.players[1]!, id: 'u3', nickname: '참가자2', friendCode: 'CODE3', slot: 2 });
      state.allReady = true;
      state.players.forEach(p => (p.isReady = true));
      mockGetRoomState.mockResolvedValue(state);
      const socket = makeSocket('u1');
      const game = makeNamespace();

      await handleRoomStart(game as any, socket as any);

      const savedState = mockSaveRoomState.mock.calls[0]![0]!;
      expect(savedState.startedAt).toBeTypeOf('number');
      expect(savedState.gameId).toBeTypeOf('string');
      // status와 current는 startRound가 한 번에 바꾼다 (R8)
      expect(savedState.status).toBe('LOBBY');
      expect(vi.mocked(startRound)).toHaveBeenCalledWith(game, 'ABC123', 0);
    });

    it('LBBY-02: 모드2는 4명 미만이면 시작을 거부한다', async () => {
      const state = makeRoomState();
      state.mode = 2;
      state.allReady = true;
      state.players.forEach(p => (p.isReady = true));
      mockGetRoomState.mockResolvedValue(state);
      const socket = makeSocket('u1');
      const game = makeNamespace();

      await handleRoomStart(game as any, socket as any);

      expect(socket.emit).toHaveBeenCalledWith(SERVER_EVENT.ERROR, {
        code: 'INSUFFICIENT_PLAYERS',
        message: '최소 4명이 모여야 시작할 수 있어요.',
      });
      expect(mockSaveRoomState).not.toHaveBeenCalled();
    });

    it('LBBY-02: 모드1은 3명 미만이면 시작을 거부한다', async () => {
      const state = makeRoomState();
      state.allReady = true;
      state.players.forEach(p => (p.isReady = true));
      mockGetRoomState.mockResolvedValue(state);
      const socket = makeSocket('u1');
      const game = makeNamespace();

      await handleRoomStart(game as any, socket as any);

      expect(socket.emit).toHaveBeenCalledWith(SERVER_EVENT.ERROR, {
        code: 'INSUFFICIENT_PLAYERS',
        message: '최소 3명이 모여야 시작할 수 있어요.',
      });
      expect(mockSaveRoomState).not.toHaveBeenCalled();
      expect(vi.mocked(startRound)).not.toHaveBeenCalled();
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
      const u2 = savedState.players.find(p => p.id === 'u2');
      expect(u2?.isHost).toBe(true);
      // u1은 제거됨
      expect(savedState.players.find(p => p.id === 'u1')).toBeUndefined();

      // room:state broadcast
      expect(game._broadcastEmit).toHaveBeenCalledWith(
        SERVER_EVENT.ROOM_STATE,
        expect.objectContaining({ hostId: 'u2' }),
      );
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

      expect(mockRedisDel).toHaveBeenCalledWith('room:ABC123:state', 'room:ABC123:password');
      // 빈 방에는 saveRoomState 호출 안 함
      expect(mockSaveRoomState).not.toHaveBeenCalled();
    });

    it('이전 방의 지연된 퇴장은 새 방의 참가 상태를 지우지 않는다', async () => {
      mockGetRoomState.mockResolvedValue(makeRoomState());
      vi.mocked(getUserRoom).mockResolvedValueOnce('NEW123');
      await handleRoomLeave(makeNamespace() as never, makeSocket('u1', ['room:ABC123']) as never, ['ABC123']);
      expect(clearUserRoom).not.toHaveBeenCalled();
      expect(mockSetPresence).not.toHaveBeenCalled();
    });

    it('같은 유저의 다른 방 소켓이 살아 있으면 stale disconnect를 ONLINE으로 덮지 않는다', async () => {
      const state = makeRoomState();
      mockGetRoomState.mockResolvedValue(state);
      const socket = makeSocket('u1', ['room:ABC123']);
      const game = {
        ...makeNamespace(),
        in: vi.fn(() => ({
          fetchSockets: vi.fn().mockResolvedValue([{ id: 'u1-active-socket', data: { userId: 'u1' } }]),
        })),
      };

      await handleRoomLeave(game as any, socket as any);

      expect(mockSaveRoomState).not.toHaveBeenCalled();
      expect(clearUserRoom).not.toHaveBeenCalled();
      expect(mockSetPresence).not.toHaveBeenCalledWith('u1', 'ONLINE');
    });

    it('OFFL-05/D-08: mode===2 상태의 MODE2_* 진행 중 퇴장은 handleMode2PlayerLeft로 라우팅되고 handlePlayerLeft는 호출되지 않는다', async () => {
      const state = makeRoomState();
      state.mode = 2;
      state.status = 'MODE2_DRAW_PHASE';
      mockGetRoomState.mockResolvedValue(state);
      const socket = makeSocket('u1', ['room:ABC123']);
      const game = makeNamespace();

      await handleRoomLeave(game as any, socket as any);

      expect(mockHandleMode2PlayerLeft).toHaveBeenCalledWith(game, 'ABC123', 'u1');
      expect(mockHandlePlayerLeft).not.toHaveBeenCalled();
    });

    it('mode===1 상태의 MODE1_ROUND_START 진행 중 퇴장은 handlePlayerLeft로 라우팅되고 handleMode2PlayerLeft는 호출되지 않는다', async () => {
      const state = makeRoomState();
      state.status = 'MODE1_ROUND_START';
      mockGetRoomState.mockResolvedValue(state);
      const socket = makeSocket('u1', ['room:ABC123']);
      const game = makeNamespace();

      await handleRoomLeave(game as any, socket as any);

      expect(mockHandlePlayerLeft).toHaveBeenCalledWith(game, 'ABC123', 'u1');
      expect(mockHandleMode2PlayerLeft).not.toHaveBeenCalled();
    });
  });

  // Pitfall 5: 재입장 시 이미 이탈(left=true)한 플레이어 거부
  describe('handleRoomJoin — 재입장 거부 (left=true)', () => {
    it('게임 진행 중(MODE2_DRAW_PHASE) left=true 플레이어의 재입장은 ALREADY_LEFT를 emit하고 connected를 복원하지 않는다', async () => {
      const state = makeRoomState();
      state.mode = 2;
      state.status = 'MODE2_DRAW_PHASE';
      state.players[0]!.left = true;
      state.players[0]!.connected = false;
      mockGetRoomState.mockResolvedValue(state);
      const socket = makeSocket('u1', []);
      const game = makeNamespace();

      await handleRoomJoin(game as any, socket as any, 'ABC123');

      expect(socket.emit).toHaveBeenCalledWith(SERVER_EVENT.ERROR, {
        code: 'ALREADY_LEFT',
        message: expect.any(String),
      });
      expect(state.players[0]!.connected).toBe(false);
      expect(mockSaveRoomState).not.toHaveBeenCalled();
    });

    it('LOBBY/AWARD로 새 게임이 시작된 방에서는 left=true였던 플레이어도 정상 재입장한다', async () => {
      const state = makeRoomState();
      state.status = 'LOBBY';
      state.players[0]!.left = true;
      state.players[0]!.connected = false;
      mockGetRoomState.mockResolvedValue(state);
      const socket = makeSocket('u1', []);
      const game = makeNamespace();

      await handleRoomJoin(game as any, socket as any, 'ABC123');

      expect(state.players[0]!.connected).toBe(true);
      expect(socket.emit).not.toHaveBeenCalledWith(
        SERVER_EVENT.ERROR,
        expect.objectContaining({ code: 'ALREADY_LEFT' }),
      );
    });
  });
});
