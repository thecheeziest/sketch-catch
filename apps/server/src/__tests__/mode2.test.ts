import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest';
import type { RoomState, Player } from '@sketch-catch/shared';

// rooms.service mock
vi.mock('../services/rooms.service.js', () => ({
  getRoomState: vi.fn(),
  saveRoomState: vi.fn(),
}));

import { getRoomState, saveRoomState } from '../services/rooms.service.js';
import {
  startMode2,
  handleMode2Prompt,
  handleMode2DrawDone,
  handleMode2Answer,
  currentAssignee,
  phaseForStep,
} from '../socket/handlers/mode2.js';

const mockGetRoomState = vi.mocked(getRoomState);
const mockSaveRoomState = vi.mocked(saveRoomState);

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
});
