import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest';
import type { RoomState, Player, Mode2StepContent } from '@sketch-catch/shared';

// rooms.service mock
vi.mock('../services/rooms.service.js', () => ({
  getRoomState: vi.fn(),
  saveRoomState: vi.fn(),
}));

// replay.service mock — GIF 생성 여부만 검증(D-10), 실제 생성 로직은 06-05 책임
vi.mock('../services/replay.service.js', () => ({
  generateSheetGifs: vi.fn().mockResolvedValue(undefined),
}));

import { getRoomState, saveRoomState } from '../services/rooms.service.js';
import { generateSheetGifs } from '../services/replay.service.js';
import {
  startMode2Review,
  handleMode2VoteBest,
  computeBestSheets,
} from '../socket/handlers/mode2-review.js';
import { finalStepForPlayerCount, phaseForStep } from '../socket/handlers/mode2.js';

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
      const authorId = players[(ownerIndex + stepIndex) % playerCount]!.id;
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
    players,
    config: {
      roundCount: 1,
      drawTimer: 30,
      answerTimer: 10,
      categories: ['ANIMAL'],
      playerCountMax: 12,
    },
    scoreboard: {},
    current: { step: finalStepForPlayerCount(playerCount) + 1, phase: 'ANSWER', sheets, submitted: [], startedAt: Date.now() },
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
  let sharedState: RoomState | null = initial;
  mockGetRoomState.mockImplementation(async () => sharedState);
  mockSaveRoomState.mockImplementation(async (s: RoomState) => {
    sharedState = s;
  });
  return {
    get state() {
      return sharedState!;
    },
  };
}

function makeSocket(userId: string) {
  return { data: { userId }, rooms: new Set(['room:ABC123']) };
}

function frameDuration(content: Mode2StepContent): number {
  if (content.kind === 'DRAW') return 4000;
  return 3000;
}

async function advanceCurrentSheet(ctl: { state: RoomState }): Promise<void> {
  const review = ctl.state.current as any;
  const sheet = review.sheets[review.currentSheetIndex];
  for (const step of sheet.steps) {
    await vi.advanceTimersByTimeAsync(frameDuration(step.content));
  }
}

describe('mode2-review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('slideshow', () => {
    it('startMode2Review 후 판정 없이 subPhase=SLIDESHOW, currentSheetIndex=0 로 첫 시트 공개가 시작된다', async () => {
      const initial = makeCompletedMode2State(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2Review(game as any, 'ABC123');

      const review = ctl.state.current as any;
      expect(review.subPhase).toBe('SLIDESHOW');
      expect(review.currentSheetIndex).toBe(0);
      expect(review.currentFrameIndex).toBe(0);
      expect(review.sheets.length).toBe(4);
      expect(review.sheets[0].finalJudge).toBeNull();
    });

    it('4명 시트는 PROMPT → DRAW → ANSWER → DRAW → ANSWER 순서로 공개된다', async () => {
      const initial = makeCompletedMode2State(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2Review(game as any, 'ABC123');
      const sheet0 = (ctl.state.current as any).sheets[0];

      expect(sheet0.steps.map((step: any) => phaseForStep(step.stepIndex))).toEqual([
        'PROMPT',
        'DRAW',
        'ANSWER',
        'DRAW',
        'ANSWER',
      ]);
    });

    it('슬라이드쇼 프레임이 서버 타이머로 자동 진행되며, 마지막 프레임 후 다음 시트를 바로 공개한다', async () => {
      const initial = makeCompletedMode2State(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2Review(game as any, 'ABC123');

      expect((ctl.state.current as any).currentFrameIndex).toBe(0);

      await vi.advanceTimersByTimeAsync(3000); // PROMPT 프레임 종료
      expect((ctl.state.current as any).currentFrameIndex).toBe(1);

      await vi.advanceTimersByTimeAsync(4000); // DRAW 프레임 종료
      expect((ctl.state.current as any).currentFrameIndex).toBe(2);

      await vi.advanceTimersByTimeAsync(3000); // ANSWER 프레임 종료
      expect((ctl.state.current as any).currentFrameIndex).toBe(3);

      await vi.advanceTimersByTimeAsync(4000); // DRAW 프레임 종료
      expect((ctl.state.current as any).currentFrameIndex).toBe(4);

      await vi.advanceTimersByTimeAsync(3000); // 마지막 ANSWER 프레임 종료 → 다음 시트
      const review = ctl.state.current as any;
      expect(review.currentSheetIndex).toBe(1);
      expect(review.subPhase).toBe('SLIDESHOW');
      expect(review.currentFrameIndex).toBe(0);
    });
  });

  describe('best sheet vote', () => {
    it('computeBestSheets: 최다 득표 시트를 반환한다', () => {
      expect(computeBestSheets({ u1: 'sA', u2: 'sB', u3: 'sB' })).toEqual(['sB']);
    });

    it('computeBestSheets: 동률이면 공동 베스트(집합)를 반환한다', () => {
      const result = computeBestSheets({ u1: 'sA', u2: 'sB' });
      expect(new Set(result)).toEqual(new Set(['sA', 'sB']));
    });

    it('모든 시트 판정+슬라이드쇼 완료 후 subPhase=BEST_VOTE로 전환된다', async () => {
      const initial = makeCompletedMode2State(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2Review(game as any, 'ABC123');
      await advanceCurrentSheet(ctl);
      await advanceCurrentSheet(ctl);
      await advanceCurrentSheet(ctl);
      await advanceCurrentSheet(ctl);

      const review = ctl.state.current as any;
      expect(review.subPhase).toBe('BEST_VOTE');
    });

    it('본인 소유 시트에 대한 투표는 거부(무시)된다', async () => {
      const initial = makeCompletedMode2State(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2Review(game as any, 'ABC123');
      await advanceCurrentSheet(ctl);
      await advanceCurrentSheet(ctl);
      await advanceCurrentSheet(ctl);
      await advanceCurrentSheet(ctl);

      const review = ctl.state.current as any;
      const ownSheet = review.sheets.find((s: any) => s.ownerId === 'p0');

      await handleMode2VoteBest(game as any, makeSocket('p0') as any, { sheetId: ownSheet.sheetId });

      const after = ctl.state.current as any;
      expect(after.votes.p0).toBeUndefined();
    });

    it('전원 투표 완료 시 BEST_REVEAL로 전환되고 bestSheetIds가 최다 득표 시트로 설정된다', async () => {
      const initial = makeCompletedMode2State(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2Review(game as any, 'ABC123');
      await advanceCurrentSheet(ctl);
      await advanceCurrentSheet(ctl);
      await advanceCurrentSheet(ctl);
      await advanceCurrentSheet(ctl);

      const review = ctl.state.current as any;
      const sheetByOwner = (id: string) => review.sheets.find((s: any) => s.ownerId === id);
      const p1Sheet = sheetByOwner('p1');
      const p2Sheet = sheetByOwner('p2');

      // p0→p1시트, p1→p2시트, p2→p1시트, p3→p1시트: p1 시트가 3표로 최다 득표
      await handleMode2VoteBest(game as any, makeSocket('p0') as any, { sheetId: p1Sheet.sheetId });
      await handleMode2VoteBest(game as any, makeSocket('p1') as any, { sheetId: p2Sheet.sheetId });
      await handleMode2VoteBest(game as any, makeSocket('p2') as any, { sheetId: p1Sheet.sheetId });
      await handleMode2VoteBest(game as any, makeSocket('p3') as any, { sheetId: p1Sheet.sheetId });

      const after = ctl.state.current as any;
      expect(after.subPhase).toBe('BEST_REVEAL');
      expect(after.bestSheetIds).toEqual([p1Sheet.sheetId]);
    });

    it('20초 무응답 시 타임아웃으로 BEST_REVEAL로 전환된다', async () => {
      const initial = makeCompletedMode2State(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2Review(game as any, 'ABC123');
      await advanceCurrentSheet(ctl);
      await advanceCurrentSheet(ctl);
      await advanceCurrentSheet(ctl);
      await advanceCurrentSheet(ctl);

      await vi.advanceTimersByTimeAsync(20000);

      const review = ctl.state.current as any;
      expect(review.subPhase).toBe('BEST_REVEAL');
    });

    it('BEST_REVEAL 이후 GIF 사전 생성이 트리거되고(D-10) status가 AWARD로 전환된다', async () => {
      const initial = makeCompletedMode2State(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2Review(game as any, 'ABC123');
      await advanceCurrentSheet(ctl);
      await advanceCurrentSheet(ctl);
      await advanceCurrentSheet(ctl);
      await advanceCurrentSheet(ctl);

      const review = ctl.state.current as any;
      const sheetByOwner = (id: string) => review.sheets.find((s: any) => s.ownerId === id);
      await handleMode2VoteBest(game as any, makeSocket('p0') as any, { sheetId: sheetByOwner('p1').sheetId });
      await handleMode2VoteBest(game as any, makeSocket('p1') as any, { sheetId: sheetByOwner('p2').sheetId });
      await handleMode2VoteBest(game as any, makeSocket('p2') as any, { sheetId: sheetByOwner('p1').sheetId });
      await handleMode2VoteBest(game as any, makeSocket('p3') as any, { sheetId: sheetByOwner('p1').sheetId });

      await vi.advanceTimersByTimeAsync(4000); // BEST_REVEAL 연출 딜레이

      expect(mockGenerateSheetGifs).toHaveBeenCalledTimes(1);
      expect(ctl.state.status).toBe('AWARD');
    });
  });
});
