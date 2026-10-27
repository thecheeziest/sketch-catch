import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  reduced: false,
  play: vi.fn((_name: string) => vi.fn()),
  cancel: vi.fn(),
  covered: undefined as ((finished: boolean) => void) | undefined,
  done: undefined as ((finished: boolean) => void) | undefined,
  reaction: undefined as ((started: boolean, previous: boolean) => void) | undefined,
}));
vi.mock('@/shared/lib/feedback', () => ({ playFeedback: native.play }));
vi.mock('react-native-reanimated', async () => {
  const { useRef } = await import('react');
  return {
    Easing: { linear: (value: number) => value },
    cancelAnimation: native.cancel,
    useReducedMotion: () => native.reduced,
    useSharedValue: (value: number) => useRef({ value }).current,
    runOnJS: (callback: unknown) => callback,
    useAnimatedReaction: (_prepare: unknown, reaction: typeof native.reaction) => {
      native.reaction = reaction;
    },
    withTiming: (target: number, _options: unknown, callback: (finished: boolean) => void) => {
      if (target === 1) native.covered = callback;
      else native.done = callback;
      return target;
    },
    withDelay: (_delay: number, animation: unknown) => animation,
  };
});

import { useCoverTransition } from './useCoverTransition';

type Props = { sound: 'coins' | 'curtain'; startCovered?: boolean; ready?: boolean };
let renderer: ReactTestRenderer | undefined;
const onDone = vi.fn();
function Harness(props: Props) {
  useCoverTransition({ ...props, coverMs: 650, holdMs: 140, revealMs: 650, onDone });
  return null;
}
function mount(props: Props) {
  act(() => {
    renderer = create(createElement(Harness, props));
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  native.reduced = false;
  native.covered = undefined;
  native.done = undefined;
  native.reaction = undefined;
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
});

describe('꾸미기 전환 효과음 싱크', () => {
  it('커튼 닫기 후 로딩 중에는 조용하고 실제 열기 프레임에서만 열림음을 낸다', () => {
    mount({ sound: 'curtain', ready: false });
    expect(native.play).toHaveBeenLastCalledWith('curtainClose');
    act(() => native.covered?.(true));
    expect(native.play).toHaveBeenCalledTimes(1);
    act(() => renderer?.update(createElement(Harness, { sound: 'curtain', ready: true })));
    // ready 변경·hold 시작만으로 소리를 내지 않는다.
    expect(native.play).toHaveBeenCalledTimes(1);
    act(() => native.reaction?.(true, false));
    expect(native.play).toHaveBeenLastCalledWith('curtainOpen');
    act(() => native.reaction?.(true, false));
    expect(native.play).toHaveBeenCalledTimes(2);
  });

  it('옷장 최초 진입은 닫힌 커튼을 유지하고 걷힐 때만 소리를 낸다', () => {
    mount({ sound: 'curtain', startCovered: true, ready: false });
    expect(native.play).not.toHaveBeenCalled();
    act(() => renderer?.update(createElement(Harness, { sound: 'curtain', startCovered: true, ready: true })));
    act(() => native.reaction?.(true, false));
    expect(native.play.mock.calls).toEqual([['curtainOpen']]);
  });

  it('샵 최초 진입은 로딩 중 코인음을 유지하고 낙하 종료 단계에 잔향으로 교체한다', () => {
    mount({ sound: 'coins', startCovered: true, ready: false });
    const stopRain = native.play.mock.results[0]?.value;
    act(() => renderer?.update(createElement(Harness, { sound: 'coins', startCovered: true, ready: false })));
    expect(native.play.mock.calls).toEqual([['coinRain']]);
    expect(stopRain).not.toHaveBeenCalled();
    act(() => renderer?.update(createElement(Harness, { sound: 'coins', startCovered: true, ready: true })));
    act(() => native.reaction?.(true, false));
    expect(stopRain).toHaveBeenCalledOnce();
    expect(native.play).toHaveBeenLastCalledWith('coinRainTail');
    const stopTail = native.play.mock.results[1]?.value;
    act(() => native.done?.(true));
    expect(stopTail).toHaveBeenCalledOnce();
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('화면 이탈은 효과음·애니메이션을 취소하고 뒤늦은 프레임의 소리를 막는다', () => {
    mount({ sound: 'coins' });
    const stop = native.play.mock.results[0]?.value;
    act(() => renderer?.unmount());
    act(() => native.reaction?.(true, false));
    expect(stop).toHaveBeenCalledOnce();
    expect(native.cancel).toHaveBeenCalledOnce();
    expect(native.play).toHaveBeenCalledTimes(1);
    renderer = undefined;
  });

  it('동작 줄이기로 생략된 전환에는 효과음을 내지 않는다', () => {
    native.reduced = true;
    mount({ sound: 'curtain' });
    act(() => native.reaction?.(true, false));
    expect(native.play).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledOnce();
  });
});
