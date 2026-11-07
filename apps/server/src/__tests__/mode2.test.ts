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

// 공개식 진입은 mode2-review 테스트에서 따로 검증한다 (여기서는 전환 호출만 확인)
vi.mock('../socket/handlers/mode2-review.js', () => ({
  startMode2Review: vi.fn(),
}));

// 시간 초과 시 빈 제시어를 채울 랜덤 단어
vi.mock('../services/word.service.js', () => ({
  pickRoundWord: vi.fn(async () => ({ word: '사과', category: 'FOOD' })),
}));

import { getRoomState, saveRoomState } from '../services/rooms.service.js';
import { endGame } from '../socket/handlers/game.js';
import {
  startMode2,
  handleMode2Draft,
  handleMode2Prompt,
  handleMode2DrawDone,
  handleMode2Answer,
  handleMode2PlayerLeft,
  currentAssignee,
  phaseForStep,
  finalStepForPlayerCount,
  planAssignments,
  type Mode2Current,
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

function makeStroke(authorId = 'client-author') {
  return [
    {
      id: 'stroke-1',
      authorId,
      color: '#000000',
      width: 2,
      points: [{ x: 0.1, y: 0.2, t: 0 }],
      startTime: 0,
    },
  ];
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

function socketOf(userId: string) {
  return { data: { userId }, rooms: new Set(['room:ABC123']) };
}

// 배정표 기준으로 시트 1장을 제출한다 (단계별 제출 이벤트)
async function submitOne(game: ReturnType<typeof makeNamespace>, ctl: { state: RoomState }, sheetId: string) {
  const current = ctl.state.current as Mode2Current;
  const userId = current.assignments?.[sheetId];
  if (!userId) return;
  const socket = socketOf(userId);
  if (current.phase === 'PROMPT') await handleMode2Prompt(game as any, socket, { sheetId, text: '강아지' });
  else if (current.phase === 'DRAW') await handleMode2DrawDone(game as any, socket, { sheetId, strokes: makeStroke() });
  else await handleMode2Answer(game as any, socket, { sheetId, text: '멍멍이' });
}

// 배정받은 사람 전원(except 제외)이 이번 단계를 제출한다
async function submitAll(game: ReturnType<typeof makeNamespace>, ctl: { state: RoomState }, except: string[] = []) {
  const current = ctl.state.current as Mode2Current;
  const sheetIds = Object.entries(current.assignments ?? {})
    .filter(([, userId]) => userId && !except.includes(userId))
    .map(([sheetId]) => sheetId);
  for (const sheetId of sheetIds) await submitOne(game, ctl, sheetId);
}

describe('mode2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sheet rotation: 인원과 관계없이 한 사람이 (글, 그림) 2단계를 연달아 맡고 다음 사람에게 넘긴다', () => {
    const { players } = makeMode2RoomState(4);
    expect(currentAssignee(players, 0, 0).id).toBe('p0'); // A 제시어
    expect(currentAssignee(players, 0, 1).id).toBe('p0'); // A 그림
    expect(currentAssignee(players, 0, 2).id).toBe('p1'); // B 정답
    expect(currentAssignee(players, 0, 3).id).toBe('p1'); // B 그림
    expect(currentAssignee(players, 0, 7).id).toBe('p3'); // D 그림
    // D의 시트는 A가 맞힌다
    expect(currentAssignee(players, 3, 2).id).toBe('p0');

    const odd = makeMode2RoomState(5).players;
    expect(currentAssignee(odd, 0, 1).id).toBe('p0');
    expect(currentAssignee(odd, 0, 9).id).toBe('p4');
  });

  it('planAssignments: 나간 사람은 빼고, 이미 맡았던 시트(원조자 포함)는 다시 주지 않는다', () => {
    const players = makeMode2RoomState(4).players;
    players[1]!.left = true;
    const sheets = players.map((p, ownerIndex) => ({
      sheetId: p.id,
      ownerIndex,
      steps: [
        { kind: 'PROMPT' as const, authorId: p.id, text: 'x' },
        { kind: 'DRAW' as const, authorId: p.id, strokes: [] },
      ],
    }));
    const plan = planAssignments(players, sheets, 1);
    // 순번대로면 p0 시트 → p1(나감). 시트를 못 받은 p0은 자기 시트라 받을 수 없어 다른 짝을 찾는다
    expect(Object.values(plan)).not.toContain('p1');
    for (const [sheetId, userId] of Object.entries(plan)) expect(userId).not.toBe(sheetId);
    const assigned = Object.values(plan).filter(Boolean);
    expect(new Set(assigned).size).toBe(assigned.length);
    expect(assigned).toHaveLength(3); // 남은 3명 모두 시트를 받는다
  });

  it('phase 순서: step0=PROMPT, 홀수=DRAW, 짝수(0제외)=ANSWER', () => {
    expect(phaseForStep(0)).toBe('PROMPT');
    expect(phaseForStep(1)).toBe('DRAW');
    expect(phaseForStep(2)).toBe('ANSWER');
    expect(phaseForStep(3)).toBe('DRAW');
    expect(phaseForStep(4)).toBe('ANSWER');
  });

  it('finalStepForPlayerCount: 마지막 사람의 그림까지 2N단계로 끝난다', () => {
    expect(finalStepForPlayerCount(4)).toBe(7);
    expect(finalStepForPlayerCount(5)).toBe(9);
  });

  describe('mode2 phase transition', () => {
    it('startMode2 후 status=MODE2_PROMPT_PHASE, N개 시트가 생성되고 단계 정보는 담당자에게만 20초로 전달된다', async () => {
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
        expect(game.to).toHaveBeenCalledWith(`user:p${i}`);
      });
      const stepPayload = game._broadcastEmit.mock.calls.find(([event]) => event === 'mode2:step')?.[1];
      expect(stepPayload).toMatchObject({ phase: 'PROMPT', durationSec: 20, remainingMs: 20000, totalSteps: 8 });
    });

    it('전원 제출 시 시간을 기다리지 않고 다음 단계로 넘어가며, 단계 시작 시각과 남은 시간이 새로 잡힌다', async () => {
      const initial = makeMode2RoomState(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123');
      await vi.advanceTimersByTimeAsync(7000);
      game._broadcastEmit.mockClear();

      const step0Current = ctl.state.current as any;
      for (const sheet of step0Current.sheets) {
        const assignee = currentAssignee(initial.players, sheet.ownerIndex, step0Current.step);
        const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };
        await handleMode2Prompt(game as any, socket as any, { sheetId: sheet.sheetId, text: '강아지' });
      }

      expect(ctl.state.status).toBe('MODE2_DRAW_PHASE');
      const current = ctl.state.current as any;
      expect(current.step).toBe(1);
      expect(current.startedAt).toBe(Date.now());
      const stepPayload = game._broadcastEmit.mock.calls.find(([event]) => event === 'mode2:step')?.[1];
      expect(stepPayload).toMatchObject({ phase: 'DRAW', durationSec: 40, remainingMs: 42500, cueMs: 2500 });
      // 원조자가 자기 제시어를 먼저 그린다
      current.sheets.forEach((sheet: any) => {
        expect(currentAssignee(initial.players, sheet.ownerIndex, 1).id).toBe(initial.players[sheet.ownerIndex]!.id);
      });

      // 그림이 도착하면 '그림을 맞혀주세요!' 안내 시간이 정답 제한 시간 앞에 붙는다
      game._broadcastEmit.mockClear();
      for (const sheet of current.sheets) {
        const assignee = currentAssignee(initial.players, sheet.ownerIndex, current.step);
        const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };
        await handleMode2DrawDone(game as any, socket as any, { sheetId: sheet.sheetId, strokes: makeStroke() });
      }
      expect(ctl.state.status).toBe('MODE2_ANSWER_PHASE');
      const answerPayload = game._broadcastEmit.mock.calls.find(([event]) => event === 'mode2:step')?.[1];
      expect(answerPayload).toMatchObject({ phase: 'ANSWER', durationSec: 15, remainingMs: 16500, cueMs: 1500 });
    });

    it.each([3, 4, 5])('%i명 게임은 마지막 사람의 그림까지 진행한 뒤 MODE2_REVIEW로 전환된다', async playerCount => {
      const initial = makeMode2RoomState(playerCount);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123');

      async function submitAllForStep() {
        const current = ctl.state.current as any;
        const wasAnswer = current.phase === 'ANSWER';
        for (const sheet of current.sheets) {
          const assignee = currentAssignee(initial.players, sheet.ownerIndex, current.step);
          const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };
          if (current.phase === 'PROMPT') {
            await handleMode2Prompt(game as any, socket as any, { sheetId: sheet.sheetId, text: '강아지' });
          } else if (current.phase === 'DRAW') {
            await handleMode2DrawDone(game as any, socket as any, { sheetId: sheet.sheetId, strokes: makeStroke() });
          } else {
            await handleMode2Answer(game as any, socket as any, { sheetId: sheet.sheetId, text: '멍멍이' });
          }
        }
        if (wasAnswer) await vi.advanceTimersByTimeAsync(1500 + 15000 + 800);
      }

      for (let step = 0; step < playerCount * 2 - 1; step++) {
        await submitAllForStep();
        expect(ctl.state.status).toBe(step % 2 === 0 ? 'MODE2_DRAW_PHASE' : 'MODE2_ANSWER_PHASE');
      }
      await submitAllForStep();
      expect(ctl.state.status).toBe('MODE2_REVIEW');
      const sheets = (ctl.state.current as any).sheets;
      expect(sheets[0].steps).toHaveLength(playerCount * 2);
      expect(sheets[0].steps.at(-1)).toMatchObject({ kind: 'DRAW', authorId: `p${playerCount - 1}` });
    });
  });

  describe('mode2 timeout', () => {
    it('시간 초과 시 작성 중이던 초안을 자동 제출하고, 빈 제시어는 랜덤 단어로 채운다 (D-08)', async () => {
      const initial = makeMode2RoomState(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123');
      const sheetId = (ctl.state.current as any).sheets[0].sheetId;
      await handleMode2Draft({ data: { userId: 'p0' }, rooms: new Set(['room:ABC123']) } as any, {
        sheetId,
        text: '  초안 제시어  ',
      });

      await vi.advanceTimersByTimeAsync(20 * 1000 + 800);

      expect(ctl.state.status).toBe('MODE2_DRAW_PHASE');
      const current = ctl.state.current as any;
      expect(current.step).toBe(1);
      expect(current.drafts).toEqual({});
      expect(current.sheets[0].steps[0]).toMatchObject({ kind: 'PROMPT', text: '초안 제시어' });
      expect(current.sheets[1].steps[0]).toMatchObject({ kind: 'PROMPT', text: '사과' });
    });

    it('그리기 시간 초과 시 제출하지 않은 그림도 초안 stroke로 넘어간다', async () => {
      const initial = makeMode2RoomState(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123');
      await vi.advanceTimersByTimeAsync(20 * 1000 + 800);
      expect(ctl.state.status).toBe('MODE2_DRAW_PHASE');

      const sheetId = (ctl.state.current as any).sheets[0].sheetId;
      await handleMode2Draft({ data: { userId: 'p0' }, rooms: new Set(['room:ABC123']) } as any, {
        sheetId,
        strokes: makeStroke(),
      });
      await vi.advanceTimersByTimeAsync(2500 + 40 * 1000 + 800);

      expect(ctl.state.status).toBe('MODE2_ANSWER_PHASE');
      const sheet = (ctl.state.current as any).sheets[0];
      expect(sheet.steps[1]).toMatchObject({ kind: 'DRAW', authorId: 'p0' });
      expect(sheet.steps[1].strokes).toHaveLength(1);
    });
  });

  describe('mode2 권한', () => {
    it('assigneeId가 아닌 유저의 제출은 상태 변경 없이 무시된다', async () => {
      const initial = makeMode2RoomState(4);
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
    it('handleMode2Prompt: text가 PROMPT_MAX_LENGTH(15)를 넘으면 서버가 잘라서 저장한다', async () => {
      const initial = makeMode2RoomState(4);
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
      expect(savedSheet.steps[0].text).toBe('a'.repeat(15));
    });

    it('handleMode2Answer: 앞뒤 공백을 trim하고 길이를 제한한다', async () => {
      const initial = makeMode2RoomState(4);
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
        await handleMode2DrawDone(game as any, socket as any, { sheetId: sheet.sheetId, strokes: makeStroke() });
      }

      const answerPhase = ctl.state.current as any;
      const sheet = answerPhase.sheets[0];
      const assignee = currentAssignee(initial.players, sheet.ownerIndex, answerPhase.step);
      const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };

      await handleMode2Answer(game as any, socket as any, { sheetId: sheet.sheetId, text: '  멍멍이  ' });

      const savedSheet = (ctl.state.current as any).sheets.find((s: any) => s.sheetId === sheet.sheetId);
      expect(savedSheet.steps.at(-1).text).toBe('멍멍이');
      // 제출한 답안은 수정할 수 없다 — 재제출·제출 후 초안은 무시된다
      await handleMode2Answer(game as never, socket, { sheetId: sheet.sheetId, text: '수정한 답안' });
      await handleMode2Draft(socket, { sheetId: sheet.sheetId, text: '제출 후 마지막 입력' });
      expect(savedSheet.steps.at(-1).text).toBe('멍멍이');
      expect(savedSheet.steps).toHaveLength(3);
      // 나머지 전원이 제출하면 마감을 기다리지 않고 바로 다음 단계로 넘어간다
      for (const item of answerPhase.sheets.slice(1)) {
        const writer = currentAssignee(initial.players, item.ownerIndex, answerPhase.step);
        await handleMode2Answer(
          game as never,
          { data: { userId: writer.id }, rooms: new Set(['room:ABC123']) },
          { sheetId: item.sheetId, text: '첫 답안' },
        );
      }
      expect(ctl.state.status).toBe('MODE2_DRAW_PHASE');
      expect(savedSheet.steps.at(-1).text).toBe('멍멍이');
      // 이미 다음 단계로 넘어간 뒤의 지연된 answer 이벤트는 무시한다.
      const count = savedSheet.steps.length;
      await handleMode2Answer(game as never, socket, { sheetId: sheet.sheetId, text: '늦은 답안' });
      expect(savedSheet.steps).toHaveLength(count);
    });

    it('handleMode2DrawDone: strokes가 300개를 넘으면 300개로 잘리고, authorId는 클라이언트 값이 아닌 검증된 assignee로 강제된다', async () => {
      const initial = makeMode2RoomState(4);
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
      const initial = makeMode2RoomState(4);
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
      const beforeStepCount = sheet.steps.length;

      await handleMode2DrawDone(game as any, socket as any, {
        sheetId: sheet.sheetId,
        strokes: ['not-an-object', { id: 's1' /* color/width/points 누락 */ }] as any,
      });

      const savedSheet = (ctl.state.current as any).sheets.find((s: any) => s.sheetId === sheet.sheetId);
      expect(savedSheet.steps.length).toBe(beforeStepCount);
      expect((ctl.state.current as any).submitted).not.toContain(sheet.sheetId);
    });
  });

  describe('handleMode2PlayerLeft (OFFL-05)', () => {
    it('첫 그림 전에 원조자가 나가면 그 시트는 빠지고, 남은 전원 제출 상태가 되어 바로 다음 단계로 advance한다', async () => {
      const initial = makeMode2RoomState(5);
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

      // step1: 원조자가 자기 시트를 그린다 — ownerIndex=1 시트의 담당자가 p1, 나머지 4장은 정상 제출
      const step1 = ctl.state.current as any;
      const leaverSheet = step1.sheets.find((s: any) => s.ownerIndex === 1);
      const otherSheets = step1.sheets.filter((s: any) => s.ownerIndex !== 1);
      for (const sheet of otherSheets) {
        const assignee = currentAssignee(initial.players, sheet.ownerIndex, step1.step);
        const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };
        await handleMode2DrawDone(game as any, socket as any, { sheetId: sheet.sheetId, strokes: makeStroke() });
      }
      expect(ctl.state.status).toBe('MODE2_DRAW_PHASE'); // 아직 leaverSheet 미제출 — advance 안됨

      // p1(leaverSheet 담당자)이 이탈
      await handleMode2PlayerLeft(game as any, 'ABC123', 'p1');

      const leftPlayer = ctl.state.players.find((p: any) => p.id === 'p1')!;
      expect(leftPlayer.left).toBe(true);
      expect(leftPlayer.connected).toBe(false);

      // 이어 그릴 그림이 없으므로 시트를 빼고 -> 남은 시트 전원 제출 완료로 step2 ANSWER로 advance
      expect(mockEndGame).not.toHaveBeenCalled();
      expect(ctl.state.status).toBe('MODE2_ANSWER_PHASE');
      const advancedCurrent = ctl.state.current as Mode2Current;
      expect(advancedCurrent.step).toBe(2);
      expect(advancedCurrent.sheets.map(sheet => sheet.sheetId)).not.toContain(leaverSheet.sheetId);
      // 나간 사람은 새 차례에서 배정받지 않는다
      expect(Object.values(advancedCurrent.assignments ?? {})).not.toContain('p1');
    });

    it('그리던 그림이 있는 상태로 나가면 그 그림을 보존한다', async () => {
      const initial = makeMode2RoomState(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123');
      await submitAll(game, ctl);
      const leaverSheet = (ctl.state.current as Mode2Current).sheets.find(sheet => sheet.sheetId === 'p1')!;
      await handleMode2Draft(socketOf('p1'), { sheetId: 'p1', strokes: makeStroke() });

      await handleMode2PlayerLeft(game as any, 'ABC123', 'p1');

      expect(leaverSheet.steps[1]).toMatchObject({ kind: 'DRAW', authorId: 'p1' });
      expect((ctl.state.current as Mode2Current).sheets.map(sheet => sheet.sheetId)).toContain('p1');
    });

    it('정답 단계 중 이탈: 낸 답안은 버리고 기다리지 않으며, 이후 누구도 자기가 맡았던 시트를 다시 받지 않는다', async () => {
      const initial = makeMode2RoomState(5);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123');
      await submitAll(game, ctl); // PROMPT
      await submitAll(game, ctl); // 원조자 DRAW
      const answer = ctl.state.current as Mode2Current;
      expect(answer.phase).toBe('ANSWER');
      const leaverSheetId = Object.entries(answer.assignments!).find(([, userId]) => userId === 'p2')![0];
      await submitOne(game, ctl, leaverSheetId);

      // p2를 뺀 나머지만 제출해도 바로 다음 단계로 넘어간다
      await handleMode2PlayerLeft(game as any, 'ABC123', 'p2');
      await submitAll(game, ctl);
      expect(ctl.state.status).toBe('MODE2_DRAW_PHASE');
      const leaverSheet = (ctl.state.current as Mode2Current).sheets.find(sheet => sheet.sheetId === leaverSheetId)!;
      expect(leaverSheet.steps).toHaveLength(2); // p2의 답안은 버려지고 원조자 그림으로 돌아간다

      // 끝까지 진행 — 타이머 없이 전원 제출만으로 공개식에 도착해야 한다
      for (let guard = 0; guard < 20 && ctl.state.status !== 'MODE2_REVIEW'; guard++) await submitAll(game, ctl);
      expect(ctl.state.status).toBe('MODE2_REVIEW');

      for (const sheet of (ctl.state.current as Mode2Current).sheets) {
        const authors = sheet.steps.map(step => step.authorId);
        // [글, 그림] 2개씩 같은 사람 — 같은 사람이 한 시트를 두 번 맡지 않는다
        const pairAuthors = authors.filter((_, index) => index % 2 === 0);
        expect(new Set(pairAuthors).size).toBe(pairAuthors.length);
        authors.forEach((author, index) => {
          if (index % 2 === 1) expect(author).toBe(authors[index - 1]);
        });
        expect(sheet.steps.every((step, index) => step.kind === phaseForStep(index))).toBe(true);
        expect(authors.filter(author => author === 'p2').length).toBeLessThanOrEqual(2);
      }
    });

    it('자리를 비운 사람은 마감까지 기다리고, 아무것도 남기지 않았으면 빈칸 대신 그 차례를 쉰다', async () => {
      const initial = makeMode2RoomState(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123');
      await submitAll(game, ctl);
      await submitAll(game, ctl);
      const answer = ctl.state.current as Mode2Current;
      const awaySheetId = Object.entries(answer.assignments!).find(([, userId]) => userId === 'p3')![0];
      ctl.state.players.find(p => p.id === 'p3')!.connected = false;

      await submitAll(game, ctl, ['p3']);
      expect(ctl.state.status).toBe('MODE2_ANSWER_PHASE'); // 자리 비움은 기다린다

      await vi.advanceTimersByTimeAsync(1500 + 15000 + 800);
      const draw = ctl.state.current as Mode2Current;
      expect(draw.phase).toBe('DRAW');
      expect(draw.assignments![awaySheetId]).toBeNull();
      expect(draw.sheets.find(sheet => sheet.sheetId === awaySheetId)!.steps).toHaveLength(2);
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

    it('MODE2_REVIEW 중 이탈은 공개식을 끊지 않고 left 마킹·시상식 명단 제외만 한다', async () => {
      const initial = makeMode2RoomState(4);
      const ctl = makeStatefulMocks(initial);
      const game = makeNamespace();

      await startMode2(game as any, 'ABC123');

      async function submitAllForStep() {
        const current = ctl.state.current as any;
        const wasAnswer = current.phase === 'ANSWER';
        for (const sheet of current.sheets) {
          const assignee = currentAssignee(initial.players, sheet.ownerIndex, current.step);
          const socket = { data: { userId: assignee.id }, rooms: new Set(['room:ABC123']) };
          if (current.phase === 'PROMPT') {
            await handleMode2Prompt(game as any, socket as any, { sheetId: sheet.sheetId, text: '강아지' });
          } else if (current.phase === 'DRAW') {
            await handleMode2DrawDone(game as any, socket as any, { sheetId: sheet.sheetId, strokes: makeStroke() });
          } else {
            await handleMode2Answer(game as any, socket as any, { sheetId: sheet.sheetId, text: '멍멍이' });
          }
        }
        if (wasAnswer) await vi.advanceTimersByTimeAsync(1500 + 15000 + 800);
      }

      // step0~7 전부 제출 -> REVIEW 진입
      for (let step = 0; step < 8; step++) await submitAllForStep();
      expect(ctl.state.status).toBe('MODE2_REVIEW');

      const beforeSheets = JSON.parse(JSON.stringify((ctl.state.current as any).sheets));

      await handleMode2PlayerLeft(game as any, 'ABC123', 'p2');

      const p2 = ctl.state.players.find((p: any) => p.id === 'p2')!;
      expect(p2.left).toBe(true);
      expect(p2.connected).toBe(false);
      expect(p2.inAward).toBe(false);
      expect(mockEndGame).not.toHaveBeenCalled();
      expect(ctl.state.status).toBe('MODE2_REVIEW');
      // 시트 내용 변경 없음
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
