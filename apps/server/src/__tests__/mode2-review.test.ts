import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest';
import type { RoomState, Player, Mode2StepContent, Mode2ReviewSheet } from '@sketch-catch/shared';
import { MODE2_REVEAL_SHEET_GAP_MS, getSheetRevealDurationMs } from '@sketch-catch/shared';

const reviewStore = vi.hoisted(() => new Map<string, Mode2ReviewSheet[]>());

// rooms.service mock
vi.mock('../services/rooms.service.js', () => ({
  getRoomState: vi.fn(),
  saveRoomState: vi.fn(),
}));

// replay.service mock — 시트 기록 여부만 검증(D-10), GIF 렌더링은 gif.test 책임
vi.mock('../services/replay.service.js', () => ({
  saveReplays: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/reviewStore.js', () => ({
  saveReviewSheets: vi.fn(async (code: string, sheets: Mode2ReviewSheet[]) => {
    reviewStore.set(code, sheets);
  }),
  getReviewSheets: vi.fn(async (code: string) => reviewStore.get(code) ?? null),
}));

vi.mock('../services/chatStore.js', () => ({
  clearRoomChat: vi.fn(),
}));

// 시상식 명단 표시만 확인 — presence 갱신(redis)은 award 테스트 책임
vi.mock('../socket/handlers/award.js', () => ({
  beginAward: vi.fn(async (_game: unknown, state: RoomState) => {
    for (const p of state.players) p.inAward = !p.left;
  }),
}));

vi.mock('../socket/handlers/coinReward.js', () => ({
  settleMode2Rewards: vi.fn().mockResolvedValue(undefined),
}));

import { getRoomState, saveRoomState } from '../services/rooms.service.js';
import { saveReplays } from '../services/replay.service.js';
import { clearRoomChat } from '../services/chatStore.js';
import { startMode2Review, resendReview } from '../socket/handlers/mode2-review.js';
import { currentAssignee, finalStepForPlayerCount } from '../socket/handlers/mode2.js';

const mockGetRoomState = vi.mocked(getRoomState);
const mockSaveRoomState = vi.mocked(saveRoomState);
const mockSaveReplays = vi.mocked(saveReplays);

function makeCompletedMode2State(playerCount: number): RoomState {
  const players: Player[] = Array.from({ length: playerCount }, (_, i) => ({
    id: `p${i}`,
    nickname: `player${i}`,
    friendCode: `CODE${i}`,
    characterId: 'cat',
    slot: i,
    isHost: i === 0,
    isReady: true,
    connected: true,
  }));

  const sheets = players.map((_, ownerIndex) => {
    const stepCount = finalStepForPlayerCount(playerCount) + 1;
    const steps: Mode2StepContent[] = Array.from({ length: stepCount }, (_, stepIndex) => {
      const authorId = currentAssignee(players, ownerIndex, stepIndex).id;
      if (stepIndex === 0) return { kind: 'PROMPT', authorId, text: `prompt-${ownerIndex}` };
      if (stepIndex % 2 === 1) return { kind: 'DRAW', authorId, strokes: [] };
      return { kind: 'ANSWER', authorId, text: `answer-${ownerIndex}` };
    });
    return { sheetId: players[ownerIndex]!.id, ownerIndex, steps };
  });

  return {
    code: 'ABC123',
    hostId: 'p0',
    mode: 2,
    status: 'MODE2_REVIEW',
    gameId: 'g1',
    players,
    config: {
      roundCount: 1,
      drawTimer: 30,
      answerTimer: 10,
      categories: ['ANIMAL'],
      playerCountMax: 12,
    },
    scoreboard: {},
    current: {
      step: finalStepForPlayerCount(playerCount) + 1,
      phase: 'DRAW',
      sheets,
      submitted: [],
      drafts: {},
      startedAt: Date.now(),
    },
    title: '테스트 방',
    locked: false,
    allReady: true,
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

function makeStatefulMocks(initial: RoomState) {
  let sharedState: RoomState = initial;
  mockGetRoomState.mockImplementation(async () => sharedState);
  mockSaveRoomState.mockImplementation(async (s: RoomState) => {
    sharedState = s;
  });
  return {
    get state() {
      return sharedState;
    },
  };
}

function emitted(game: ReturnType<typeof makeNamespace>, event: string) {
  return game._broadcastEmit.mock.calls.filter(([name]) => name === event).map(([, payload]) => payload);
}

// 4인 게임 = 시트마다 4건 발표
const SHEET_MS = getSheetRevealDurationMs(4);

describe('mode2 정답 공개식', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reviewStore.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('진입 시 시상식 명단·채팅을 열고, 시트 전체를 한 번 보내며 방 상태에는 그림을 싣지 않는다', async () => {
    const ctl = makeStatefulMocks(makeCompletedMode2State(4));
    const game = makeNamespace();

    await startMode2Review(game as any, 'ABC123');

    expect(ctl.state.status).toBe('MODE2_REVIEW');
    expect(ctl.state.players.every(p => p.inAward)).toBe(true);
    expect(clearRoomChat).toHaveBeenCalledWith('ABC123');
    expect(JSON.stringify(ctl.state.current)).not.toContain('strokes');
    expect(ctl.state.current).toMatchObject({ sheetIndex: 0, entryCounts: [4, 4, 4, 4], finished: false });

    const [review] = emitted(game, 'mode2:review');
    expect(review).toMatchObject({ gameId: 'g1', live: { sheetIndex: 0, elapsedMs: 0 } });
    expect(review.sheets).toHaveLength(4);
    expect(reviewStore.get('ABC123')).toHaveLength(4);

    expect(mockSaveReplays).toHaveBeenCalledTimes(1);
    const replaySheets = mockSaveReplays.mock.calls[0]![1];
    expect(replaySheets).toHaveLength(4);
    expect(replaySheets[0]).toMatchObject({ sheetId: 'p0', ownerId: 'p0', participantIds: ['p0', 'p1', 'p2', 'p3'] });
    expect(replaySheets[0]!.steps).toHaveLength(8);
  });

  it('시트 1장이 끝날 때만 다음 시트 위치를 보내고, 마지막 시트가 끝나면 AWARD로 전환한다', async () => {
    const ctl = makeStatefulMocks(makeCompletedMode2State(4));
    const game = makeNamespace();

    await startMode2Review(game as any, 'ABC123');

    // 시트 안의 발표 진행은 기기가 직접 재생 — 서버는 그동안 아무것도 보내지 않는다
    await vi.advanceTimersByTimeAsync(SHEET_MS - 1);
    expect(emitted(game, 'mode2:review:live')).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(emitted(game, 'mode2:review:live').at(-1)).toEqual({ gameId: 'g1', live: { sheetIndex: 1, elapsedMs: 0 } });
    expect(emitted(game, 'mode2:review')).toHaveLength(1);
    expect(ctl.state.status).toBe('MODE2_REVIEW');

    await vi.advanceTimersByTimeAsync(SHEET_MS * 3);
    expect(ctl.state.status).toBe('AWARD');
    expect(emitted(game, 'mode2:review:live').at(-1)).toEqual({ gameId: 'g1', live: null });
    expect(game._broadcastEmit).toHaveBeenLastCalledWith('room:state', ctl.state);
  });

  it('재입장한 소켓에는 시트 전체와 현재 시트 경과 시간을 다시 보낸다', async () => {
    const ctl = makeStatefulMocks(makeCompletedMode2State(4));
    const game = makeNamespace();
    await startMode2Review(game as any, 'ABC123');
    await vi.advanceTimersByTimeAsync(MODE2_REVEAL_SHEET_GAP_MS + 500);

    const socket = { emit: vi.fn() };
    await resendReview(socket as any, ctl.state);

    expect(socket.emit).toHaveBeenCalledWith(
      'mode2:review',
      expect.objectContaining({ live: { sheetIndex: 0, elapsedMs: MODE2_REVEAL_SHEET_GAP_MS + 500 } }),
    );
    expect(socket.emit.mock.calls[0]![1].sheets).toHaveLength(4);
  });
});
