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
import { handleStrokeStart, handleStrokeClear } from '../socket/handlers/stroke.js';
import { handleChatSend, handleAnswerAccept } from '../socket/handlers/chat.js';

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
    turnSchedule: ['u1', 'u2', 'u3', 'u1', 'u2', 'u3', 'u1', 'u2', 'u3'],
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

describe('stroke auth (DRAW-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveRoomState.mockResolvedValue(undefined);
  });

  function makeStrokeRoomState(): RoomState {
    return makeRoomState({
      status: 'MODE1_ROUND_START',
      current: {
        roundIndex: 0,
        drawerId: 'userA',
        prompt: '강아지',
        startedAt: Date.now(),
      } satisfies Mode1RoundCurrent,
    });
  }

  function makeStrokeSocket(userId: string) {
    const emitSpy = vi.fn();
    const toReturn = { emit: emitSpy };
    const socket = {
      data: { userId },
      rooms: new Set(['room:ABC123']),
      to: vi.fn(() => toReturn),
      emit: vi.fn(),
    };
    return { socket, emitSpy };
  }

  it('비출제자 stroke:start는 서버에서 거부 — broadcast 0회', async () => {
    mockGetRoomState.mockResolvedValueOnce(makeStrokeRoomState());

    const { socket, emitSpy } = makeStrokeSocket('userB'); // 비출제자
    await handleStrokeStart({} as any, socket as any, { strokeId: 's1', color: '#000', width: 8 });

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('출제자 stroke:start는 except(sender)로 broadcast — authorId는 서버가 설정', async () => {
    mockGetRoomState.mockResolvedValueOnce(makeStrokeRoomState());

    const { socket, emitSpy } = makeStrokeSocket('userA'); // 출제자
    await handleStrokeStart({} as any, socket as any, { strokeId: 's1', color: '#000', width: 8 });

    expect(socket.to).toHaveBeenCalledWith('room:ABC123');
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith('stroke:remote', {
      strokeId: 's1',
      authorId: 'userA',
      color: '#000',
      width: 8,
    });
  });

  it('stroke:clear는 출제자만 broadcast, 비출제자는 거부', async () => {
    // 비출제자 거부
    mockGetRoomState.mockResolvedValueOnce(makeStrokeRoomState());
    const { socket: socketB, emitSpy: emitB } = makeStrokeSocket('userB');
    await handleStrokeClear({} as any, socketB as any);
    expect(emitB).not.toHaveBeenCalled();

    // 출제자 broadcast
    mockGetRoomState.mockResolvedValueOnce(makeStrokeRoomState());
    const { socket: socketA, emitSpy: emitA } = makeStrokeSocket('userA');
    await handleStrokeClear({} as any, socketA as any);
    expect(emitA).toHaveBeenCalledTimes(1);
    expect(emitA).toHaveBeenCalledWith('stroke:remote', {
      strokeId: '__clear__',
      authorId: 'userA',
      ended: true,
    });
  });
});

describe('drawer chat (GAME-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveRoomState.mockResolvedValue(undefined);
  });

  function makeChatRoomState(drawerId = 'userA') {
    return makeRoomState({
      status: 'MODE1_ROUND_START',
      current: {
        roundIndex: 0,
        drawerId,
        prompt: '강아지',
        startedAt: Date.now(),
      } satisfies Mode1RoundCurrent,
    });
  }

  function makeChatSocket(userId: string) {
    const emitSpy = vi.fn();
    return {
      socket: {
        data: { userId },
        rooms: new Set(['room:ABC123']),
        emit: vi.fn(),
      },
      emitSpy,
    };
  }

  it('drawer chat: 출제자의 chat:send는 서버에서 차단된다', async () => {
    mockGetRoomState.mockResolvedValueOnce(makeChatRoomState('userA'));
    const game = makeNamespace();
    const { socket } = makeChatSocket('userA'); // 출제자
    await handleChatSend(game as any, socket as any, { text: '안녕' });
    expect(game._broadcastEmit).not.toHaveBeenCalledWith('chat:message', expect.anything());
  });
});

describe('answer detect (MD1-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveRoomState.mockResolvedValue(undefined);
  });

  function makeChatRoomState(overrides: Partial<RoomState> = {}) {
    return makeRoomState({
      status: 'MODE1_ROUND_START',
      current: {
        roundIndex: 0,
        drawerId: 'userA',
        prompt: '강아지',
        startedAt: Date.now() - 5000,
      } satisfies Mode1RoundCurrent,
      ...overrides,
    });
  }

  it('answer detect: text.trim() === prompt.trim() 일치 시 정답 처리', async () => {
    mockGetRoomState.mockResolvedValueOnce(makeChatRoomState());
    // endRound 내부에서 getRoomState 재호출
    mockGetRoomState.mockResolvedValueOnce(makeChatRoomState({ status: 'MODE1_ROUND_START' }));
    const game = makeNamespace();
    const socket = { data: { userId: 'userB' }, rooms: new Set(['room:ABC123']), emit: vi.fn() };
    await handleChatSend(game as any, socket as any, { text: '  강아지 ' });
    // chat:message broadcast
    expect(game._broadcastEmit).toHaveBeenCalledWith('chat:message', expect.objectContaining({ userId: 'userB' }));
    // chat:correct broadcast
    expect(game._broadcastEmit).toHaveBeenCalledWith('chat:correct', expect.objectContaining({ userId: 'userB' }));
    // saveRoomState 호출 (endRound가 실행됨)
    expect(mockSaveRoomState).toHaveBeenCalled();
  });

  it('answer detect: 부분 일치는 오답 — chat:correct 미발생', async () => {
    mockGetRoomState.mockResolvedValueOnce(makeChatRoomState());
    const game = makeNamespace();
    const socket = { data: { userId: 'userB' }, rooms: new Set(['room:ABC123']), emit: vi.fn() };
    await handleChatSend(game as any, socket as any, { text: '강아지다' });
    // chat:message는 broadcast됨
    expect(game._broadcastEmit).toHaveBeenCalledWith('chat:message', expect.anything());
    // chat:correct는 미발생
    expect(game._broadcastEmit).not.toHaveBeenCalledWith('chat:correct', expect.anything());
    // endRound 미호출 → saveRoomState 0회
    expect(mockSaveRoomState).not.toHaveBeenCalled();
  });
});

describe('answer accept (MD1-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveRoomState.mockResolvedValue(undefined);
  });

  function makeAcceptRoomState() {
    return makeRoomState({
      status: 'MODE1_ROUND_START',
      current: {
        roundIndex: 0,
        drawerId: 'userA',
        prompt: '강아지',
        startedAt: Date.now() - 3000,
      } satisfies Mode1RoundCurrent,
    });
  }

  it('answer accept: 출제자가 messageId로 수동 인정 시 정답 처리', async () => {
    // 먼저 chat:send로 메시지 생성 (recentMessages에 저장됨)
    mockGetRoomState.mockResolvedValueOnce(makeAcceptRoomState());
    const game = makeNamespace();
    const socketB = { data: { userId: 'userB' }, rooms: new Set(['room:ABC123']), emit: vi.fn() };
    await handleChatSend(game as any, socketB as any, { text: '고양이' });

    // broadcast된 chat:message의 id 추출
    const chatMsgCall = game._broadcastEmit.mock.calls.find(
      (c: unknown[]) => c[0] === 'chat:message',
    );
    const messageId: string = (chatMsgCall as [string, { id: string }])[1].id;

    // 출제자가 answer:accept
    vi.clearAllMocks();
    mockSaveRoomState.mockResolvedValue(undefined);
    mockGetRoomState.mockResolvedValueOnce(makeAcceptRoomState());
    mockGetRoomState.mockResolvedValueOnce(makeAcceptRoomState());
    const socketA = { data: { userId: 'userA' }, rooms: new Set(['room:ABC123']), emit: vi.fn() };
    await handleAnswerAccept(game as any, socketA as any, { messageId });

    expect(game._broadcastEmit).toHaveBeenCalledWith('chat:correct', expect.objectContaining({ userId: 'userB' }));
    expect(mockSaveRoomState).toHaveBeenCalled();
  });

  it('answer accept: 비출제자의 answer:accept는 거부', async () => {
    mockGetRoomState.mockResolvedValueOnce(makeAcceptRoomState());
    const game = makeNamespace();
    const socketC = { data: { userId: 'userC' }, rooms: new Set(['room:ABC123']), emit: vi.fn() };
    await handleAnswerAccept(game as any, socketC as any, { messageId: 'some-id' });
    expect(mockSaveRoomState).not.toHaveBeenCalled();
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
