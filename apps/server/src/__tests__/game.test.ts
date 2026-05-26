import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest';
import type { RoomState, Mode1RoundCurrent } from '@sketch-catch/shared';

// word.service mock
vi.mock('../services/word.service.js', () => ({
  pickWord: vi.fn().mockResolvedValue({ word: '강아지', category: 'ANIMAL' }),
}));

// rooms.service mock
vi.mock('../services/rooms.service.js', () => ({
  getRoomState: vi.fn(),
  saveRoomState: vi.fn(),
}));

import { getRoomState, saveRoomState } from '../services/rooms.service.js';
import { startRound, endRound, calcScore } from '../socket/handlers/game.js';

const mockGetRoomState = vi.mocked(getRoomState);
const mockSaveRoomState = vi.mocked(saveRoomState);

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
        isReady: true,
        connected: true,
      },
      {
        id: 'u2',
        nickname: '참가자',
        friendCode: 'CODE2',
        characterId: 'dog',
        slot: 1,
        isHost: false,
        isReady: true,
        connected: true,
      },
      {
        id: 'u3',
        nickname: '참가자2',
        friendCode: 'CODE3',
        characterId: 'rabbit',
        slot: 2,
        isHost: false,
        isReady: true,
        connected: true,
      },
    ],
    config: {
      roundCount: 3,
      drawTimer: 30,
      answerTimer: 30,
      categories: ['ANIMAL'],
      playerCountMax: 6,
    },
    scoreboard: {},
    current: null,
    title: '테스트 방',
    locked: false,
    allReady: true,
    ...overrides,
  } as RoomState;
}

function makeNamespace() {
  const broadcastEmit = vi.fn();
  return {
    to: vi.fn(() => ({ emit: broadcastEmit })),
    emit: vi.fn(),
    _broadcastEmit: broadcastEmit,
  };
}

describe('game state machine (MD1-01, MD1-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSaveRoomState.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('round drawer: roundIndex % players.length 로 출제자가 순환된다', async () => {
    const state0 = makeRoomState();
    const state1 = makeRoomState();
    const state2 = makeRoomState();
    // roundIndex=0 → players[0]=u1
    mockGetRoomState.mockResolvedValueOnce(state0);
    const game0 = makeNamespace();
    await startRound(game0 as any, 'ABC123', 0);
    const savedState0 = mockSaveRoomState.mock.calls[0]![0]! as RoomState;
    expect((savedState0.current as Mode1RoundCurrent).drawerId).toBe('u1');

    // roundIndex=1 → players[1]=u2
    vi.clearAllMocks();
    mockSaveRoomState.mockResolvedValue(undefined);
    mockGetRoomState.mockResolvedValueOnce(state1);
    const game1 = makeNamespace();
    await startRound(game1 as any, 'ABC123', 1);
    const savedState1 = mockSaveRoomState.mock.calls[0]![0]! as RoomState;
    expect((savedState1.current as Mode1RoundCurrent).drawerId).toBe('u2');

    // roundIndex=3 → 3 % 3 = 0 → players[0]=u1 (모듈로 순환)
    vi.clearAllMocks();
    mockSaveRoomState.mockResolvedValue(undefined);
    mockGetRoomState.mockResolvedValueOnce(state2);
    const game2 = makeNamespace();
    await startRound(game2 as any, 'ABC123', 3);
    const savedState2 = mockSaveRoomState.mock.calls[0]![0]! as RoomState;
    expect((savedState2.current as Mode1RoundCurrent).drawerId).toBe('u1');
  });

  it('round drawer: 제시어는 출제자에게만 전달된다 (promptForDrawer)', async () => {
    const state = makeRoomState();
    mockGetRoomState.mockResolvedValueOnce(state);
    const game = makeNamespace();

    await startRound(game as any, 'ABC123', 0);

    // broadcast된 game:round:start에 promptForDrawer 포함
    expect(game._broadcastEmit).toHaveBeenCalledWith(
      'game:round:start',
      expect.objectContaining({
        drawerId: 'u1',
        promptForDrawer: '강아지',
        durationSec: 30,
      }),
    );
  });

  it('round timer: drawTimer초 후 자동으로 MODE1_ROUND_END 전이', async () => {
    const state = makeRoomState();
    mockGetRoomState.mockResolvedValueOnce(state);
    const game = makeNamespace();

    await startRound(game as any, 'ABC123', 0);

    // 타이머 만료 전
    expect(mockSaveRoomState).toHaveBeenCalledTimes(1);

    // endRound가 saveRoomState를 호출하기 위해 다시 state 반환
    const stateAfterStart = mockSaveRoomState.mock.calls[0]![0]! as RoomState;
    mockGetRoomState.mockResolvedValueOnce(stateAfterStart);
    // 다음 라운드(roundIndex=1) 시작을 위한 state (3초 delay 후)
    mockGetRoomState.mockResolvedValueOnce(null); // endGame 방지

    // drawTimer*1000ms 경과
    await vi.advanceTimersByTimeAsync(30 * 1000);

    // endRound가 호출되어 saveRoomState가 다시 호출됨
    expect(mockSaveRoomState).toHaveBeenCalledTimes(2);
    const savedAfterEnd = mockSaveRoomState.mock.calls[1]![0]! as RoomState;
    expect(savedAfterEnd.status).toBe('MODE1_ROUND_END');
  });
});

describe('score calc (MD1-04)', () => {
  it('score calc: 맞힌 사람 max(100, 1000 - 경과초*30)', () => {
    // 0ms 경과: guesser=max(100, 1000-0*30)=1000
    expect(calcScore(0).guesserScore).toBe(1000);
    // 30000ms=30초 경과: guesser=max(100, 1000-30*30)=max(100,100)=100
    expect(calcScore(30000).guesserScore).toBe(100);
    // 60000ms=60초 경과: guesser=max(100, 1000-60*30)=max(100,-800)=100
    expect(calcScore(60000).guesserScore).toBe(100);
  });

  it('score calc: 출제자 min(500, 맞힌점수*0.5)', () => {
    // 0ms: guesser=1000, drawer=min(500, floor(1000*0.5))=min(500,500)=500
    expect(calcScore(0).drawerScore).toBe(500);
    // 30000ms: guesser=100, drawer=min(500, floor(100*0.5))=min(500,50)=50
    expect(calcScore(30000).drawerScore).toBe(50);
  });
});
