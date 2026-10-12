import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { RoomState, Mode2Step, Mode2ReviewState, RoundStart } from '@sketch-catch/shared';

const listeners = vi.hoisted(() => new Map<string, (payload: never) => void>());
vi.mock('@/shared/model/room', () => ({
  useRoomStore: {
    getState: () => ({
      socket: {
        on: (event: string, listener: (payload: never) => void) => listeners.set(event, listener),
        off: (event: string) => listeners.delete(event),
      },
    }),
  },
}));
vi.mock('@/shared/model/auth', () => ({ useAuthStore: { getState: () => ({ user: { id: 'me' } }) } }));
vi.mock('@/shared/config', () => ({ colors: { DARK_500: '#000000' } }));
import { useGameStore } from '@/features/game/model/useGameStore';
import { useMode2Store } from '@/features/mode2/model/useMode2Store';

function emit(event: string, payload: unknown) {
  listeners.get(event)?.(payload as never);
}

beforeEach(() => {
  vi.useFakeTimers();
  listeners.clear();
  useGameStore.getState().reset();
  useMode2Store.getState().reset();
});
afterEach(() => vi.useRealTimers());

describe('게임 소켓 이벤트', () => {
  it('입력 대기와 그림 시간이 같은 30초여도 제출 이벤트로 마감 시각을 새로 잡는다', () => {
    useGameStore.getState().registerGameListeners();
    emit('room:state', { gameId: 'g1' } satisfies Partial<RoomState>);
    const round: RoundStart = {
      gameId: 'g1',
      roundIndex: 0,
      drawerId: 'me',
      durationSec: 30,
      isCustomRound: true,
      needsCustomPrompt: true,
    };
    emit('game:round:start', round);
    const promptDeadline = useGameStore.getState().round!.endsAt;
    vi.advanceTimersByTime(29_000);
    emit('game:round:start', { ...round, needsCustomPrompt: false, promptForDrawer: '고양이' });
    expect(useGameStore.getState().round!.endsAt).toBe(promptDeadline + 29_000);
    expect(useGameStore.getState().waitingForPrompt).toBe(false);
    expect(useGameStore.getState().promptForDrawer).toBe('고양이');
  });

  it('모드2는 내 시트의 그림·제시어와 리뷰 페인트 정보를 보존한다', () => {
    useMode2Store.getState().registerMode2Listeners();
    emit('room:state', { gameId: 'g1' } satisfies Partial<RoomState>);
    const stroke = {
      id: 's1',
      authorId: 'other',
      color: '#FF0000',
      width: 0,
      startTime: 0,
      points: [],
      paintSpans: [{ x: 0, y: 0, width: 1, height: 1 }],
    };
    const step: Mode2Step = {
      gameId: 'g1',
      sheetId: 'sheet',
      assigneeId: 'me',
      stepIndex: 2,
      phase: 'ANSWER',
      durationSec: 30,
      totalSteps: 5,
      previousContent: { kind: 'DRAW', strokes: [stroke] },
    };
    emit('mode2:step', step);
    emit('mode2:step', { ...step, sheetId: 'other', assigneeId: 'other' });
    expect(useMode2Store.getState().step).toEqual(step);
    const review: Mode2ReviewState = {
      gameId: 'g1',
      subPhase: 'SLIDESHOW',
      currentSheetIndex: 0,
      currentFrameIndex: 0,
      sheets: [
        {
          sheetId: 'sheet',
          ownerId: 'me',
          finalJudge: null,
          steps: [
            {
              stepIndex: 0,
              phase: 'PROMPT',
              authorId: 'me',
              content: { kind: 'PROMPT', authorId: 'me', text: '고양이' },
            },
            {
              stepIndex: 1,
              phase: 'DRAW',
              authorId: 'other',
              content: { kind: 'DRAW', authorId: 'other', strokes: [stroke] },
            },
          ],
        },
      ],
    };
    emit('mode2:review', review);
    expect(useMode2Store.getState().review).toEqual(review);
    emit('mode2:review', { ...review, gameId: 'old' });
    expect(useMode2Store.getState().review?.gameId).toBe('g1');
  });
});
