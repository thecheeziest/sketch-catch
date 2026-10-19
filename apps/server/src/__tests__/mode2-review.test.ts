import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest';
import type { RoomState, Player, Mode2StepContent } from '@sketch-catch/shared';
import { MODE2_REVEAL_ENTRY_MS, MODE2_REVEAL_SHEET_GAP_MS } from '@sketch-catch/shared';

// rooms.service mock
vi.mock('../services/rooms.service.js', () => ({
  getRoomState: vi.fn(),
  saveRoomState: vi.fn(),
}));

// replay.service mock — GIF 생성 여부만 검증(D-10), 실제 렌더링은 gif.test 책임
vi.mock('../services/replay.service.js', () => ({
  generateSheetGifs: vi.fn().mockResolvedValue(undefined),
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

import { getRoomState, saveRoomState } from '../services/rooms.service.js';
import { generateSheetGifs } from '../services/replay.service.js';
import { clearRoomChat } from '../services/chatStore.js';
import { startMode2Review, resendReview } from '../socket/handlers/mode2-review.js';
import { currentAssignee, finalStepForPlayerCount } from '../socket/handlers/mode2.js';

const mockGetRoomState = vi.mocked(getRoomState);
const mockSaveRoomState = vi.mocked(saveRoomState);
const mockGenerateSheetGifs = vi.mocked(generateSheetGifs);

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

function lastReview(game: ReturnType<typeof makeNamespace>) {
  const calls = game._broadcastEmit.mock.calls.filter(([event]) => event === 'mode2:review');
  return calls.at(-1)?.[1];
}

describe('mode2 정답 공개식', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('진입 시 시상식 명단·채팅을 열고, 첫 시트 첫 발표를 테두리 이동 대기 후 시작하며 GIF를 백그라운드로 만든다', async () => {
    const ctl = makeStatefulMocks(makeCompletedMode2State(4));
    const game = makeNamespace();

    await startMode2Review(game as any, 'ABC123');

    expect(ctl.state.status).toBe('MODE2_REVIEW');
    expect(ctl.state.players.every(p => p.inAward)).toBe(true);
    expect(clearRoomChat).toHaveBeenCalledWith('ABC123');
    expect(game._broadcastEmit).toHaveBeenCalledWith('room:state', ctl.state);
    expect(lastReview(game)).toMatchObject({
      gameId: 'g1',
      live: { sheetIndex: 0, entryIndex: 0, leadMs: MODE2_REVEAL_SHEET_GAP_MS, elapsedMs: 0 },
    });
    expect(lastReview(game).sheets).toHaveLength(4);

    expect(mockGenerateSheetGifs).toHaveBeenCalledTimes(1);
    const gifSheets = mockGenerateSheetGifs.mock.calls[0]![2];
    expect(gifSheets).toHaveLength(4);
    expect(gifSheets[0]).toMatchObject({ sheetId: 'p0', ownerId: 'p0', participantIds: ['p0', 'p1', 'p2', 'p3'] });
    expect(gifSheets[0]!.players[0]).toEqual({ id: 'p0', nickname: 'player0', characterId: 'cat' });
    expect(gifSheets[0]!.steps).toHaveLength(8);
  });

  it('시트마다 참가자 수만큼 발표한 뒤 다음 시트로, 마지막 발표가 끝나면 AWARD로 전환한다', async () => {
    const ctl = makeStatefulMocks(makeCompletedMode2State(4));
    const game = makeNamespace();

    await startMode2Review(game as any, 'ABC123');

    await vi.advanceTimersByTimeAsync(MODE2_REVEAL_SHEET_GAP_MS + MODE2_REVEAL_ENTRY_MS);
    expect(lastReview(game).live).toMatchObject({ sheetIndex: 0, entryIndex: 1, leadMs: 0 });

    await vi.advanceTimersByTimeAsync(MODE2_REVEAL_ENTRY_MS * 3);
    expect(lastReview(game).live).toMatchObject({
      sheetIndex: 1,
      entryIndex: 0,
      leadMs: MODE2_REVEAL_SHEET_GAP_MS,
    });
    expect(ctl.state.status).toBe('MODE2_REVIEW');

    // 남은 3개 시트 × (테두리 이동 + 4명 발표)
    await vi.advanceTimersByTimeAsync((MODE2_REVEAL_SHEET_GAP_MS + MODE2_REVEAL_ENTRY_MS * 4) * 3);
    expect(ctl.state.status).toBe('AWARD');
    expect(lastReview(game).live).toBeNull();
    expect(game._broadcastEmit).toHaveBeenLastCalledWith('room:state', ctl.state);
  });

  it('재입장한 소켓에는 현재 발표 위치를 다시 보낸다', async () => {
    const ctl = makeStatefulMocks(makeCompletedMode2State(4));
    const game = makeNamespace();
    await startMode2Review(game as any, 'ABC123');
    await vi.advanceTimersByTimeAsync(MODE2_REVEAL_SHEET_GAP_MS + 500);

    const socket = { emit: vi.fn() };
    resendReview(socket as any, ctl.state);

    expect(socket.emit).toHaveBeenCalledWith(
      'mode2:review',
      expect.objectContaining({ live: { sheetIndex: 0, entryIndex: 0, leadMs: 0, elapsedMs: 500 } }),
    );
  });
});
