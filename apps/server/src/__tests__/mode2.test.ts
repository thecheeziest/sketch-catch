import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest';
import type { RoomState, Player } from '@sketch-catch/shared';

// rooms.service mock
vi.mock('../services/rooms.service.js', () => ({
  getRoomState: vi.fn(),
  saveRoomState: vi.fn(),
}));

// game.js mock (endGame만 필요 — handleMode2PlayerLeft가 INSUFFICIENT_PLAYERS 종료 시 호출)
vi.mock('../socket/handlers/game.js', () => ({
  endGame: vi.fn(),
}));

import { getRoomState, saveRoomState } from '../services/rooms.service.js';
import { endGame } from '../socket/handlers/game.js';
import {
  startMode2,
  handleMode2Prompt,
  handleMode2DrawDone,
  handleMode2Answer,
  handleMode2PlayerLeft,
  currentAssignee,
  phaseForStep,
} from '../socket/handlers/mode2.js';

const mockGetRoomState = vi.mocked(getRoomState);
const mockSaveRoomState = vi.mocked(saveRoomState);
const mockEndGame = vi.mocked(endGame);

function makeMode2RoomState(playerCount: number, overrides: Partial<RoomState> = {}): RoomState {
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

  return {
    code: 'ABC123',
    hostId: 'p0',
    mode: 2,
    status: 'LOBBY',
    players,
    config: {
      roundCount: 1,
      drawTimer: 30,
      answerTimer: 10,
      categories: ['ANIMAL'],
      playerCountMax: 12,
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

describe('mode2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sheet rotation: N=4일 때 (ownerIndex+step)%N 으로 담당자가 시계방향 회전한다', () => {
    const { players } = makeMode2RoomState(4);
    expect(currentAssignee(players, 0, 1).id).toBe(players[1]!.id);
    expect(currentAssignee(players, 0, 4).id).toBe(players[0]!.id); // 원조자 복귀
  });

  it('phase 순서: step0=PROMPT, 홀수=DRAW, 짝수(0제외)=ANSWER', () => {
    expect(phaseForStep(0)).toBe('PROMPT');
    expect(phaseForStep(1)).toBe('DRAW');
    expect(phaseForStep(2)).toBe('ANSWER');
    expect(phaseForStep(3)).toBe('DRAW');
    expect(phaseForStep(4)).toBe('ANSWER');
  });

  describe('mode2 phase transition', () => {
    it('startMode2 후 status=MODE2_PROMPT_PHASE, N개 시트가 생성되고 모두 원조자가 담당한다', async () => {
      const initial = makeMode2RoomState(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123');

      expect(ctl.state.status).toBe('MODE2_PROMPT_PHASE');
      const current = ctl.state.current as any;
      expect(current.sheets.length).toBe(4);
      expect(current.step).toBe(0);
      current.sheets.forEach((sheet: any, i: number) => {
        expect(sheet.ownerIndex).toBe(i);
        const assignee = currentAssignee(initial.players, sheet.ownerIndex, current.step);
        expect(assignee.id).toBe(initial.players[i]!.id);
      });
    });

    it('전원 mode2:prompt 제출 → step 1, phase=DRAW, status=MODE2_DRAW_PHASE, 담당자가 시계방향 한 칸 이동', async () => {
      const initial = makeMode2RoomState(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123');

      const step0Current = ctl.state.current as any;
      for (const sheet of step0Current.sheets) {
        const assignee = currentAssignee(initial.players, sheet.ownerIndex, step0Current.step);
        const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };
        await handleMode2Prompt(game as any, socket as any, { sheetId: sheet.sheetId, text: '강아지' });
      }

      expect(ctl.state.status).toBe('MODE2_DRAW_PHASE');
      const current = ctl.state.current as any;
      expect(current.step).toBe(1);
      expect(current.phase).toBe('DRAW');
      current.sheets.forEach((sheet: any) => {
        const assignee = currentAssignee(initial.players, sheet.ownerIndex, current.step);
        expect(assignee.id).toBe(initial.players[(sheet.ownerIndex + 1) % 4]!.id);
      });
    });

    it('step이 N에 도달(작성자 복귀)하면 status=MODE2_REVIEW로 전환된다', async () => {
      const initial = makeMode2RoomState(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123');

      async function submitAllForStep() {
        const current = ctl.state.current as any;
        for (const sheet of current.sheets) {
          const assignee = currentAssignee(initial.players, sheet.ownerIndex, current.step);
          const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };
          if (current.phase === 'PROMPT') {
            await handleMode2Prompt(game as any, socket as any, { sheetId: sheet.sheetId, text: '강아지' });
          } else if (current.phase === 'DRAW') {
            await handleMode2DrawDone(game as any, socket as any, { sheetId: sheet.sheetId, strokes: [] });
          } else {
            await handleMode2Answer(game as any, socket as any, { sheetId: sheet.sheetId, text: '멍멍이' });
          }
        }
      }

      // step0 PROMPT -> step1
      await submitAllForStep();
      expect(ctl.state.status).toBe('MODE2_DRAW_PHASE');
      // step1 DRAW -> step2
      await submitAllForStep();
      expect(ctl.state.status).toBe('MODE2_ANSWER_PHASE');
      // step2 ANSWER -> step3
      await submitAllForStep();
      expect(ctl.state.status).toBe('MODE2_DRAW_PHASE');
      // step3 DRAW -> step4 (=== N) -> REVIEW
      await submitAllForStep();
      expect(ctl.state.status).toBe('MODE2_REVIEW');
    });
  });

  describe('mode2 timeout', () => {
    it('durationSec 경과 시 미제출 시트도 빈 콘텐츠로 강제 다음 단계 전환된다 (D-08)', async () => {
      const initial = makeMode2RoomState(3);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123'); // PROMPT durationSec=20

      await vi.advanceTimersByTimeAsync(20 * 1000);

      expect(ctl.state.status).toBe('MODE2_DRAW_PHASE');
      const current = ctl.state.current as any;
      expect(current.step).toBe(1);
      current.sheets.forEach((sheet: any) => {
        expect(sheet.steps[0]).toMatchObject({ kind: 'PROMPT', text: '' });
      });
    });
  });

  describe('mode2 권한', () => {
    it('assigneeId가 아닌 유저의 제출은 상태 변경 없이 무시된다', async () => {
      const initial = makeMode2RoomState(3);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123');

      vi.clearAllMocks();
      mockGetRoomState.mockImplementation(async () => ctl.state);
      mockSaveRoomState.mockImplementation(async (s: RoomState) => {
        Object.assign(ctl.state, s);
      });

      const current = ctl.state.current as any;
      const sheet = current.sheets[0];
      const wrongSocket = { data: { userId: 'not-the-assignee' }, rooms: new Set(['room:ABC123']) };

      await handleMode2Prompt(game as any, wrongSocket as any, { sheetId: sheet.sheetId, text: '몰래제출' });

      expect(mockSaveRoomState).not.toHaveBeenCalled();
    });
  });

  describe('mode2 입력 검증 (07-REVIEW CR-01) — 클라이언트 입력 절대 신뢰 금지', () => {
    it('handleMode2Prompt: text가 MAX_TEXT_LENGTH(40)를 넘으면 서버가 잘라서 저장한다', async () => {
      const initial = makeMode2RoomState(3);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123');

      const current = ctl.state.current as any;
      const sheet = current.sheets[0];
      const assignee = currentAssignee(initial.players, sheet.ownerIndex, current.step);
      const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };
      const longText = 'a'.repeat(200);

      await handleMode2Prompt(game as any, socket as any, { sheetId: sheet.sheetId, text: longText });

      const savedSheet = (ctl.state.current as any).sheets.find((s: any) => s.sheetId === sheet.sheetId);
      expect(savedSheet.steps[0].text).toBe('a'.repeat(40));
    });

    it('handleMode2Answer: 앞뒤 공백을 trim하고 길이를 제한한다', async () => {
      const initial = makeMode2RoomState(3);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123');
      const p0 = ctl.state.current as any;
      for (const sheet of p0.sheets) {
        const assignee = currentAssignee(initial.players, sheet.ownerIndex, p0.step);
        const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };
        await handleMode2Prompt(game as any, socket as any, { sheetId: sheet.sheetId, text: '강아지' });
      }
      const drawPhase = ctl.state.current as any;
      for (const sheet of drawPhase.sheets) {
        const assignee = currentAssignee(initial.players, sheet.ownerIndex, drawPhase.step);
        const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };
        await handleMode2DrawDone(game as any, socket as any, { sheetId: sheet.sheetId, strokes: [] });
      }

      const answerPhase = ctl.state.current as any;
      const sheet = answerPhase.sheets[0];
      const assignee = currentAssignee(initial.players, sheet.ownerIndex, answerPhase.step);
      const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };

      await handleMode2Answer(game as any, socket as any, { sheetId: sheet.sheetId, text: '  멍멍이  ' });

      const savedSheet = (ctl.state.current as any).sheets.find((s: any) => s.sheetId === sheet.sheetId);
      expect(savedSheet.steps.at(-1).text).toBe('멍멍이');
    });

    it('handleMode2DrawDone: strokes가 300개를 넘으면 300개로 잘리고, authorId는 클라이언트 값이 아닌 검증된 assignee로 강제된다', async () => {
      const initial = makeMode2RoomState(3);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123');
      const p0 = ctl.state.current as any;
      for (const sheet of p0.sheets) {
        const assignee = currentAssignee(initial.players, sheet.ownerIndex, p0.step);
        const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };
        await handleMode2Prompt(game as any, socket as any, { sheetId: sheet.sheetId, text: '강아지' });
      }

      const drawPhase = ctl.state.current as any;
      const sheet = drawPhase.sheets[0];
      const assignee = currentAssignee(initial.players, sheet.ownerIndex, drawPhase.step);
      const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };

      const oversizedStrokes = Array.from({ length: 500 }, (_, i) => ({
        id: `s${i}`,
        authorId: 'spoofed-user',
        color: '#000000',
        width: 0.01,
        points: [{ x: 0.1, y: 0.2, t: 100 }],
        startTime: 0,
      }));

      await handleMode2DrawDone(game as any, socket as any, { sheetId: sheet.sheetId, strokes: oversizedStrokes });

      const savedSheet = (ctl.state.current as any).sheets.find((s: any) => s.sheetId === sheet.sheetId);
      const savedStrokes = savedSheet.steps.at(-1).strokes;
      expect(savedStrokes.length).toBe(300);
      expect(savedStrokes.every((s: any) => s.authorId === assignee.id)).toBe(true);
    });

    it('handleMode2DrawDone: 배열이 아니거나 형식이 잘못된 stroke는 조용히 걸러진다', async () => {
      const initial = makeMode2RoomState(3);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123');
      const p0 = ctl.state.current as any;
      for (const sheet of p0.sheets) {
        const assignee = currentAssignee(initial.players, sheet.ownerIndex, p0.step);
        const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };
        await handleMode2Prompt(game as any, socket as any, { sheetId: sheet.sheetId, text: '강아지' });
      }

      const drawPhase = ctl.state.current as any;
      const sheet = drawPhase.sheets[0];
      const assignee = currentAssignee(initial.players, sheet.ownerIndex, drawPhase.step);
      const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };

      await handleMode2DrawDone(game as any, socket as any, {
        sheetId: sheet.sheetId,
        strokes: ['not-an-object', { id: 's1' /* color/width/points 누락 */ }] as any,
      });

      const savedSheet = (ctl.state.current as any).sheets.find((s: any) => s.sheetId === sheet.sheetId);
      expect(savedSheet.steps.at(-1).strokes).toEqual([]);
    });
  });

  describe('handleMode2PlayerLeft (OFFL-05)', () => {
    it('DRAW 단계 담당 시트 이탈: 빈 콘텐츠로 즉시 제출 처리되고 전원 제출 완료 시 다음 단계로 advance한다', async () => {
      const initial = makeMode2RoomState(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123'); // step0 PROMPT

      // 전원 prompt 제출 -> step1 DRAW
      const step0 = ctl.state.current as any;
      for (const sheet of step0.sheets) {
        const assignee = currentAssignee(initial.players, sheet.ownerIndex, step0.step);
        const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };
        await handleMode2Prompt(game as any, socket as any, { sheetId: sheet.sheetId, text: '강아지' });
      }
      expect(ctl.state.status).toBe('MODE2_DRAW_PHASE');

      // step1: ownerIndex=0 시트의 담당자는 p1 — 나머지 3장은 정상 제출
      const step1 = ctl.state.current as any;
      const leaverSheet = step1.sheets.find((s: any) => s.ownerIndex === 0);
      const otherSheets = step1.sheets.filter((s: any) => s.ownerIndex !== 0);
      for (const sheet of otherSheets) {
        const assignee = currentAssignee(initial.players, sheet.ownerIndex, step1.step);
        const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };
        await handleMode2DrawDone(game as any, socket as any, { sheetId: sheet.sheetId, strokes: [] });
      }
      expect(ctl.state.status).toBe('MODE2_DRAW_PHASE'); // 아직 leaverSheet 미제출 — advance 안됨

      // p1(leaverSheet 담당자)이 이탈
      await handleMode2PlayerLeft(game as any, 'ABC123', 'p1');

      const leftPlayer = ctl.state.players.find((p: any) => p.id === 'p1')!;
      expect(leftPlayer.left).toBe(true);
      expect(leftPlayer.connected).toBe(false);

      // 강제 빈 제출 처리 후 전원 제출 완료 -> step2 ANSWER로 advance
      expect(ctl.state.status).toBe('MODE2_ANSWER_PHASE');
      const advancedCurrent = ctl.state.current as any;
      expect(advancedCurrent.step).toBe(2);
      expect(leaverSheet.steps[1]).toMatchObject({ kind: 'DRAW', authorId: 'p1', strokes: [] });
    });

    it('활성 인원이 3명 미만이 되면 endGame(INSUFFICIENT_PLAYERS)이 호출되고 시트 처리는 건너뛴다', async () => {
      const initial = makeMode2RoomState(3);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123'); // step0 PROMPT, 3명

      // 전원 prompt 제출 -> step1 DRAW
      const step0 = ctl.state.current as any;
      for (const sheet of step0.sheets) {
        const assignee = currentAssignee(initial.players, sheet.ownerIndex, step0.step);
        const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };
        await handleMode2Prompt(game as any, socket as any, { sheetId: sheet.sheetId, text: '강아지' });
      }
      expect(ctl.state.status).toBe('MODE2_DRAW_PHASE');

      const beforeSubmitted = [...(ctl.state.current as any).submitted];

      await handleMode2PlayerLeft(game as any, 'ABC123', 'p0');

      expect(mockEndGame).toHaveBeenCalledWith(game, 'ABC123', 'INSUFFICIENT_PLAYERS');
      const p0 = ctl.state.players.find((p: any) => p.id === 'p0')!;
      expect(p0.left).toBe(true);
      // 시트 강제 제출 로직은 실행되지 않음 — submitted 배열 불변
      expect((ctl.state.current as any).submitted).toEqual(beforeSubmitted);
    });

    it('MODE2_REVIEW 중 이탈은 left만 마킹하고 시트 강제 제출은 수행하지 않는다', async () => {
      const initial = makeMode2RoomState(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123');

      async function submitAllForStep() {
        const current = ctl.state.current as any;
        for (const sheet of current.sheets) {
          const assignee = currentAssignee(initial.players, sheet.ownerIndex, current.step);
          const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };
          if (current.phase === 'PROMPT') {
            await handleMode2Prompt(game as any, socket as any, { sheetId: sheet.sheetId, text: '강아지' });
          } else if (current.phase === 'DRAW') {
            await handleMode2DrawDone(game as any, socket as any, { sheetId: sheet.sheetId, strokes: [] });
          } else {
            await handleMode2Answer(game as any, socket as any, { sheetId: sheet.sheetId, text: '멍멍이' });
          }
        }
      }

      // step0~3 전부 제출 -> REVIEW 진입
      await submitAllForStep();
      await submitAllForStep();
      await submitAllForStep();
      await submitAllForStep();
      expect(ctl.state.status).toBe('MODE2_REVIEW');

      const beforeSheets = JSON.parse(JSON.stringify((ctl.state.current as any).sheets));

      await handleMode2PlayerLeft(game as any, 'ABC123', 'p2');

      const p2 = ctl.state.players.find((p: any) => p.id === 'p2')!;
      expect(p2.left).toBe(true);
      expect(p2.connected).toBe(false);
      expect(ctl.state.status).toBe('MODE2_REVIEW');
      // REVIEW는 isMode2Active=false — 시트 내용 변경 없음
      expect((ctl.state.current as any).sheets).toEqual(beforeSheets);
    });

    it('이미 left=true인 플레이어에 대한 재호출은 아무 상태 변경 없이 조용히 종료된다 (idempotent)', async () => {
      const initial = makeMode2RoomState(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123');

      await handleMode2PlayerLeft(game as any, 'ABC123', 'p1');
      expect(mockSaveRoomState).toHaveBeenCalled();
      const callCountAfterFirst = mockSaveRoomState.mock.calls.length;

      await handleMode2PlayerLeft(game as any, 'ABC123', 'p1');

      expect(mockSaveRoomState.mock.calls.length).toBe(callCountAfterFirst); // 추가 저장 없음
    });
  });
});
