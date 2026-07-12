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
  handleMode2JudgeFinal,
  handleMode2VoteBest,
  computeBestSheets,
} from '../socket/handlers/mode2-review.js';

const mockGetRoomState = vi.mocked(getRoomState);
const mockSaveRoomState = vi.mocked(saveRoomState);
const mockGenerateSheetGifs = vi.mocked(generateSheetGifs);

// N=3 시트 슬라이드쇼 프레임 지속시간 순서: step0=PROMPT(3초), step1=DRAW(4초), step2=ANSWER(3초)
const FRAME_DURATIONS_N3 = [3000, 4000, 3000];

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
    const steps: Mode2StepContent[] = Array.from({ length: playerCount }, (_, stepIndex) => {
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
    current: { step: playerCount, phase: 'ANSWER', sheets, submitted: [], startedAt: Date.now() },
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

async function advanceThroughSheet(): Promise<void> {
  for (const ms of FRAME_DURATIONS_N3) {
    await vi.advanceTimersByTimeAsync(ms);
  }
}

// 현재 대상 시트의 원조자가 판정(ok:true)하고, 슬라이드쇼 프레임을 전부 진행시켜 다음 시트로 넘긴다.
async function judgeAndAdvance(game: any, ctl: { state: RoomState }): Promise<void> {
  const review = ctl.state.current as any;
  const sheet = review.sheets[review.currentSheetIndex];
  const owner = makeSocket(sheet.ownerId);
  await handleMode2JudgeFinal(game, owner as any, { sheetId: sheet.sheetId, ok: true });
  await advanceThroughSheet();
}

describe('mode2-review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('final judge', () => {
    it('startMode2Review 후 subPhase=FINAL_JUDGE, currentSheetIndex=0 로 첫 시트가 대상이 된다', async () => {
      const initial = makeCompletedMode2State(3);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2Review(game as any, 'ABC123');

      const review = ctl.state.current as any;
      expect(review.subPhase).toBe('FINAL_JUDGE');
      expect(review.currentSheetIndex).toBe(0);
      expect(review.sheets.length).toBe(3);
      expect(review.sheets[0].finalJudge).toBeNull();
    });

    it('원조자가 최종 판정(ok:true)하면 finalJudge가 설정되고 SLIDESHOW로 전환된다', async () => {
      const initial = makeCompletedMode2State(3);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2Review(game as any, 'ABC123');
      const sheet0 = (ctl.state.current as any).sheets[0];

      await handleMode2JudgeFinal(game as any, makeSocket(sheet0.ownerId) as any, {
        sheetId: sheet0.sheetId,
        ok: true,
      });

      const review = ctl.state.current as any;
      expect(review.sheets[0].finalJudge).toEqual({ ok: true, judgedBy: sheet0.ownerId });
      expect(review.subPhase).toBe('SLIDESHOW');
    });

    it('원조자가 아닌 유저의 판정 요청은 무시되고 상태가 변하지 않는다', async () => {
      const initial = makeCompletedMode2State(3);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2Review(game as any, 'ABC123');
      const sheet0 = (ctl.state.current as any).sheets[0];

      await handleMode2JudgeFinal(game as any, makeSocket('not-the-owner') as any, {
        sheetId: sheet0.sheetId,
        ok: true,
      });

      const review = ctl.state.current as any;
      expect(review.sheets[0].finalJudge).toBeNull();
      expect(review.subPhase).toBe('FINAL_JUDGE');
    });

    it('15초 무응답 시 서버가 자동으로 finalJudge={ok:true} 처리 후 SLIDESHOW로 전환한다', async () => {
      const initial = makeCompletedMode2State(3);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2Review(game as any, 'ABC123');
      await vi.advanceTimersByTimeAsync(15000);

      const review = ctl.state.current as any;
      expect(review.sheets[0].finalJudge).toMatchObject({ ok: true });
      expect(review.subPhase).toBe('SLIDESHOW');
    });

    it('슬라이드쇼 프레임이 서버 타이머로 자동 진행되며, 마지막 프레임 후 다음 시트 FINAL_JUDGE로 복귀한다', async () => {
      const initial = makeCompletedMode2State(3);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2Review(game as any, 'ABC123');
      const sheet0 = (ctl.state.current as any).sheets[0];
      await handleMode2JudgeFinal(game as any, makeSocket(sheet0.ownerId) as any, {
        sheetId: sheet0.sheetId,
        ok: true,
      });

      expect((ctl.state.current as any).currentFrameIndex).toBe(0);

      await vi.advanceTimersByTimeAsync(3000); // PROMPT 프레임 종료
      expect((ctl.state.current as any).currentFrameIndex).toBe(1);

      await vi.advanceTimersByTimeAsync(4000); // DRAW 프레임 종료
      expect((ctl.state.current as any).currentFrameIndex).toBe(2);

      await vi.advanceTimersByTimeAsync(3000); // ANSWER 프레임 종료 → 다음 시트
      const review = ctl.state.current as any;
      expect(review.currentSheetIndex).toBe(1);
      expect(review.subPhase).toBe('FINAL_JUDGE');
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
      const initial = makeCompletedMode2State(3);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2Review(game as any, 'ABC123');
      await judgeAndAdvance(game, ctl);
      await judgeAndAdvance(game, ctl);
      await judgeAndAdvance(game, ctl);

      const review = ctl.state.current as any;
      expect(review.subPhase).toBe('BEST_VOTE');
    });

    it('본인 소유 시트에 대한 투표는 거부(무시)된다', async () => {
      const initial = makeCompletedMode2State(3);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2Review(game as any, 'ABC123');
      await judgeAndAdvance(game, ctl);
      await judgeAndAdvance(game, ctl);
      await judgeAndAdvance(game, ctl);

      const review = ctl.state.current as any;
      const ownSheet = review.sheets.find((s: any) => s.ownerId === 'p0');

      await handleMode2VoteBest(game as any, makeSocket('p0') as any, { sheetId: ownSheet.sheetId });

      const after = ctl.state.current as any;
      expect(after.votes.p0).toBeUndefined();
    });

    it('전원 투표 완료 시 BEST_REVEAL로 전환되고 bestSheetIds가 최다 득표 시트로 설정된다', async () => {
      const initial = makeCompletedMode2State(3);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2Review(game as any, 'ABC123');
      await judgeAndAdvance(game, ctl);
      await judgeAndAdvance(game, ctl);
      await judgeAndAdvance(game, ctl);

      const review = ctl.state.current as any;
      const sheetByOwner = (id: string) => review.sheets.find((s: any) => s.ownerId === id);
      const p1Sheet = sheetByOwner('p1');
      const p2Sheet = sheetByOwner('p2');

      // p0→p1시트, p1→p2시트, p2→p1시트: p1 시트가 2표로 최다 득표
      await handleMode2VoteBest(game as any, makeSocket('p0') as any, { sheetId: p1Sheet.sheetId });
      await handleMode2VoteBest(game as any, makeSocket('p1') as any, { sheetId: p2Sheet.sheetId });
      await handleMode2VoteBest(game as any, makeSocket('p2') as any, { sheetId: p1Sheet.sheetId });

      const after = ctl.state.current as any;
      expect(after.subPhase).toBe('BEST_REVEAL');
      expect(after.bestSheetIds).toEqual([p1Sheet.sheetId]);
    });

    it('20초 무응답 시 타임아웃으로 BEST_REVEAL로 전환된다', async () => {
      const initial = makeCompletedMode2State(3);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2Review(game as any, 'ABC123');
      await judgeAndAdvance(game, ctl);
      await judgeAndAdvance(game, ctl);
      await judgeAndAdvance(game, ctl);

      await vi.advanceTimersByTimeAsync(20000);

      const review = ctl.state.current as any;
      expect(review.subPhase).toBe('BEST_REVEAL');
    });

    it('BEST_REVEAL 이후 GIF 사전 생성이 트리거되고(D-10) status가 AWARD로 전환된다', async () => {
      const initial = makeCompletedMode2State(3);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2Review(game as any, 'ABC123');
      await judgeAndAdvance(game, ctl);
      await judgeAndAdvance(game, ctl);
      await judgeAndAdvance(game, ctl);

      const review = ctl.state.current as any;
      const sheetByOwner = (id: string) => review.sheets.find((s: any) => s.ownerId === id);
      await handleMode2VoteBest(game as any, makeSocket('p0') as any, { sheetId: sheetByOwner('p1').sheetId });
      await handleMode2VoteBest(game as any, makeSocket('p1') as any, { sheetId: sheetByOwner('p2').sheetId });
      await handleMode2VoteBest(game as any, makeSocket('p2') as any, { sheetId: sheetByOwner('p1').sheetId });

      await vi.advanceTimersByTimeAsync(4000); // BEST_REVEAL 연출 딜레이

      expect(mockGenerateSheetGifs).toHaveBeenCalledTimes(1);
      expect(ctl.state.status).toBe('AWARD');
    });
  });
});
