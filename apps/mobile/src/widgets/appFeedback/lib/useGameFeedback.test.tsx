import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomState, Mode2Step, Mode2ReviewState, RoundEnd } from '@sketch-catch/shared';

const cue = vi.hoisted(() => vi.fn());
const routing = vi.hoisted(() => ({ path: '/', scene: vi.fn(), duck: vi.fn() }));
vi.mock('@/shared/lib/feedback', () => ({
  playFeedback: cue,
  setMusicScene: routing.scene,
  setMusicDucked: routing.duck,
}));
vi.mock('expo-router', () => ({ usePathname: () => routing.path }));
vi.mock('@/shared/config', () => ({ colors: { DARK_500: '#000' } }));
vi.mock('@/shared/model/auth', () => ({ useAuthStore: { getState: () => ({ user: { id: 'me' } }) } }));
vi.mock('@/shared/model/room', async () => {
  const zustand = await import('zustand');
  return {
    useRoomStore: zustand.create(() => ({
      roomState: null as RoomState | null,
      socket: null,
      isMatchmaking: false,
      matchFoundCode: null as string | null,
    })),
  };
});
import { useGameStore } from '@/features/game/model/useGameStore';
import { useMode2Store } from '@/features/mode2/model/useMode2Store';
import { useRoomStore } from '@/shared/model/room';
import { useToastStore } from '@/shared/model/toast';
import { useGameFeedback } from './useGameFeedback';
import { getMusicScene, useBackgroundMusic } from './useBackgroundMusic';
import { useTimerFeedback } from '@/shared/lib/useTimerFeedback';

let renderer: ReactTestRenderer;
function Observer() {
  useGameFeedback();
  return null;
}
function Music({ enabled }: { enabled: boolean }) {
  useBackgroundMusic(enabled);
  return null;
}
function Timer({ seconds }: { seconds: number }) {
  useTimerFeedback(seconds, 'g1:round:1');
  return null;
}
const round = { roundIndex: 0, drawerId: 'drawer', durationSec: 30, endsAt: 30000 };
const result: RoundEnd = { gameId: 'g1', roundIndex: 0, correctUserId: 'me', scoreDelta: { me: 10 }, answer: '사과' };
function room(players: string[], status: RoomState['status'] = 'LOBBY'): RoomState {
  return { code: 'ROOM01', gameId: 'g1', status, players: players.map(id => ({ id, isReady: false })) } as RoomState;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  useGameStore.getState().reset();
  useMode2Store.getState().reset();
  useRoomStore.setState({ roomState: null, isMatchmaking: false, matchFoundCode: null });
  useToastStore.setState({ toasts: [] });
});
afterEach(() => {
  act(() => renderer?.unmount());
  vi.useRealTimers();
});

describe('게임 피드백 연결', () => {
  it('라운드 재전송은 시작음을 반복하지 않고 커스텀 입력 종료는 별도 시작으로 처리한다', () => {
    act(() => {
      renderer = create(createElement(Observer));
    });
    useGameStore.setState({ gameId: 'g1', round, waitingForPrompt: true });
    useGameStore.setState({ round: { ...round } });
    expect(cue).toHaveBeenCalledTimes(1);
    useGameStore.setState({ round: { ...round }, waitingForPrompt: false });
    expect(cue).toHaveBeenLastCalledWith('roundStart', { key: 'g1:0:drawing' });
  });

  it('내 정답·타인 정답·내 그림 정답을 구분하고 chat:correct와 종료 판정을 이중 재생하지 않는다', () => {
    act(() => {
      renderer = create(createElement(Observer));
    });
    useGameStore.setState({ gameId: 'g1', round });
    cue.mockClear();
    useGameStore.setState({ correct: { userId: 'me', messageId: 'm1' } });
    expect(cue).not.toHaveBeenCalled();
    useGameStore.setState({ roundResult: result });
    expect(cue).toHaveBeenLastCalledWith('correct', { key: 'g1:0:result' });
    useGameStore.setState({ roundResult: { ...result, correctUserId: 'other' } });
    expect(cue).toHaveBeenLastCalledWith('otherCorrect', { key: 'g1:0:result' });
    useGameStore.setState({ round: { ...round, drawerId: 'me' }, roundResult: null });
    useGameStore.setState({ roundResult: { ...result, correctUserId: 'other' } });
    expect(cue).toHaveBeenLastCalledWith('drawerCorrect', { key: 'g1:0:result' });
  });

  it('오답은 본인 수신 값에서만 처리하고 종료 후 늦은 오답을 무시한다', () => {
    act(() => {
      renderer = create(createElement(Observer));
    });
    useGameStore.setState({ gameId: 'g1', round });
    cue.mockClear();
    useGameStore.setState({ wrongAnswer: { messageId: 'wrong1' } });
    expect(cue).toHaveBeenLastCalledWith('wrong', { key: 'g1:wrong1:wrong' });
    useGameStore.setState({ roundResult: { ...result, correctUserId: null } });
    expect(cue).toHaveBeenLastCalledWith('gameover', { key: 'g1:0:result' });
    cue.mockClear();
    useGameStore.setState({ wrongAnswer: { messageId: 'late' } });
    expect(cue).not.toHaveBeenCalled();
  });

  it('모드2는 내 담당 단계·공개식 발표 전환·공개식 종료에 이벤트 키를 붙인다', () => {
    act(() => {
      renderer = create(createElement(Observer));
    });
    const step: Mode2Step = {
      gameId: 'g1',
      assigneeId: 'other',
      sheetId: 's1',
      stepIndex: 0,
      phase: 'PROMPT',
      durationSec: 20,
      remainingMs: 20000,
      totalSteps: 8,
    };
    useMode2Store.setState({ gameId: 'g1', step });
    expect(cue).not.toHaveBeenCalled();
    useMode2Store.setState({ step: { ...step, assigneeId: 'me' } });
    expect(cue).toHaveBeenLastCalledWith('stepStart', { key: 'g1:0:step' });
    const review: Mode2ReviewState = {
      gameId: 'g1',
      sheets: [],
      live: { sheetIndex: 0, entryIndex: 1, leadMs: 0, elapsedMs: 0 },
    };
    useMode2Store.setState({ review });
    expect(cue).toHaveBeenLastCalledWith('frame', { key: 'g1:0:1:frame' });
    useMode2Store.setState({ review: { ...review, live: null } });
    expect(cue).toHaveBeenLastCalledWith('bestReveal', { key: 'g1:revealEnd' });
  });

  it('초기 방 스냅샷을 입장음으로 재생하지 않고 실제 인원 변경·매칭 성사에만 반응한다', () => {
    act(() => {
      renderer = create(createElement(Observer));
    });
    useRoomStore.setState({ roomState: room(['me']) });
    expect(cue).not.toHaveBeenCalled();
    useRoomStore.setState({ roomState: room(['me', 'other']) });
    expect(cue).toHaveBeenLastCalledWith('playerJoin');
    useRoomStore.setState({ roomState: room(['me']) });
    expect(cue).toHaveBeenLastCalledWith('playerLeave');
    useRoomStore.setState({ isMatchmaking: true });
    expect(cue).toHaveBeenLastCalledWith('matchStart');
    useRoomStore.setState({ matchFoundCode: 'ROOM01' });
    expect(cue).toHaveBeenLastCalledWith('matchFound');
  });

  it('토스트 종류를 명시적으로 구분하고 dismiss에서는 재생하지 않는다', () => {
    act(() => {
      renderer = create(createElement(Observer));
    });
    useToastStore.getState().show('복사 완료', 'success');
    expect(cue.mock.calls.at(-1)?.[0]).toBe('confirm');
    useToastStore.getState().show('저장 실패', 'error');
    expect(cue.mock.calls.at(-1)?.[0]).toBe('warning');
    cue.mockClear();
    useToastStore.getState().dismiss(useToastStore.getState().toasts[0]!.id);
    expect(cue).not.toHaveBeenCalled();
  });

  it('틱은 남은 초 변경에만 울리고 0초 종료를 클라이언트에서 판정하지 않는다', () => {
    act(() => {
      renderer = create(createElement(Timer, { seconds: 11 }));
    });
    act(() => renderer.update(createElement(Timer, { seconds: 10 })));
    act(() => renderer.update(createElement(Timer, { seconds: 10 })));
    expect(cue).toHaveBeenCalledOnce();
    act(() => renderer.update(createElement(Timer, { seconds: 0 })));
    expect(cue).toHaveBeenCalledOnce();
  });
});

describe('BGM 화면 연결', () => {
  it('로그인·홈·친구·설정·방 만들기는 같은 BGM을 사용한다', () => {
    for (const path of ['/login', '/onboarding/step1', '/', '/friends', '/settings', '/room/create'])
      expect(getMusicScene(path)).toBe('home');
    expect(getMusicScene('/room/ABCDEF')).toBe('lobby');
    expect(getMusicScene('/room/ABCDEF/game')).toBe('classic');
    expect(getMusicScene('/room/ABCDEF/mode2')).toBe('relay');
    expect(getMusicScene('/room/ABCDEF/mode2-review')).toBe('review');
    expect(getMusicScene('/room/ABCDEF/award')).toBe('award');
  });
  it('스플래시·강제 업데이트에서 BGM을 끈다', () => {
    routing.path = '/settings';
    act(() => {
      renderer = create(createElement(Music, { enabled: false }));
    });
    expect(routing.scene).toHaveBeenLastCalledWith(null);
    act(() => renderer.update(createElement(Music, { enabled: true })));
    expect(routing.scene).toHaveBeenLastCalledWith('home');
    act(() => renderer.update(createElement(Music, { enabled: false })));
    expect(routing.scene).toHaveBeenLastCalledWith(null);
  });
});
