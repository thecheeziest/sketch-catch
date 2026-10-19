import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const feedback = vi.hoisted(() => ({ play: vi.fn(() => vi.fn()) }));
vi.mock('./tvFeedback', () => ({ playTvFeedback: feedback.play }));
vi.mock('dripsy', () => ({ Text: 'Text', View: 'View' }));
vi.mock('@/shared/config', () => ({ colors: {}, spacing: { LG: 24, MD: 16 } }));
vi.mock('@/shared/ui/PixelFrame', () => ({ PixelFrame: 'PixelFrame' }));
vi.mock('@/shared/ui/Button', () => ({ Button: 'Button' }));
vi.mock('react-native', () => {
  type Animation = {
    duration: number;
    start: (callback?: (result: { finished: boolean }) => void) => void;
    stop: () => void;
  };
  function animation(duration: number): Animation {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let callback: ((result: { finished: boolean }) => void) | undefined;
    return {
      duration,
      start: next => {
        callback = next;
        timer = setTimeout(() => callback?.({ finished: true }), duration);
      },
      stop: () => {
        clearTimeout(timer);
        callback?.({ finished: false });
      },
    };
  }
  return {
    Animated: {
      Value: class {
        constructor(public value: number) {}
        setValue(value: number) {
          this.value = value;
        }
      },
      View: 'AnimatedView',
      timing: (_value: unknown, config: { duration: number }) => animation(config.duration),
      sequence: (animations: Animation[]) => animation(animations.reduce((sum, item) => sum + item.duration, 0)),
      parallel: (animations: Animation[]) => animation(Math.max(...animations.map(item => item.duration))),
    },
    Easing: { in: vi.fn(), out: vi.fn(), ease: vi.fn(), quad: vi.fn() },
    Modal: 'Modal',
    Pressable: 'Pressable',
    StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
  };
});

import { useTvDialog } from './useTvDialog';
import { Dialog } from '@/shared/ui/Dialog';

let renderer: ReactTestRenderer;
let dialog: ReturnType<typeof useTvDialog>;
const onClose = vi.fn();
function Harness({ visible }: { visible: boolean }) {
  dialog = useTvDialog(visible, onClose);
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
afterEach(() => {
  act(() => renderer?.unmount());
  vi.useRealTimers();
});

describe('TV 모달 수명', () => {
  it('숨겨진 모달은 재생하지 않고 열림·닫힘 전환에만 한 번 재생한다', () => {
    act(() => {
      renderer = create(createElement(Harness, { visible: false }));
    });
    expect(feedback.play).not.toHaveBeenCalled();
    act(() => renderer.update(createElement(Harness, { visible: true })));
    act(() => renderer.update(createElement(Harness, { visible: true })));
    expect(feedback.play.mock.calls).toEqual([['on']]);
    act(() => renderer.update(createElement(Harness, { visible: false })));
    expect(dialog.rendered).toBe(true);
    expect(feedback.play.mock.calls).toEqual([['on'], ['off']]);
    act(() => {
      vi.advanceTimersByTime(239);
    });
    expect(dialog.rendered).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(dialog.rendered).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('배경·뒤로가기 연타는 한 번 닫고 애니메이션 완료 뒤 부모에게 알린다', () => {
    act(() => {
      renderer = create(createElement(Harness, { visible: true }));
    });
    act(() => {
      dialog.dismiss();
      dialog.dismiss();
    });
    expect(feedback.play.mock.calls).toEqual([['on'], ['off']]);
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(240);
    });
    expect(dialog.rendered).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => renderer.update(createElement(Harness, { visible: false })));
    expect(feedback.play).toHaveBeenCalledTimes(2);
  });

  it('종료 도중 다시 열면 이전 종료가 새 모달을 숨기지 않는다', () => {
    act(() => {
      renderer = create(createElement(Harness, { visible: true }));
    });
    act(() => renderer.update(createElement(Harness, { visible: false })));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => renderer.update(createElement(Harness, { visible: true })));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(dialog.rendered).toBe(true);
    expect(dialog.closing).toBe(false);
    expect(feedback.play.mock.calls).toEqual([['on'], ['off'], ['on']]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('종료 도중 unmount되면 콜백과 예약 피드백을 취소한다', () => {
    act(() => {
      renderer = create(createElement(Harness, { visible: true }));
    });
    act(() => dialog.dismiss());
    const cancel = feedback.play.mock.results[1]?.value;
    act(() => renderer.unmount());
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('취소·저장 성공으로 visible이 false여도 마지막 내용을 유지하며 종료한다', () => {
    act(() => {
      renderer = create(createElement(Dialog, { visible: true, onClose, title: '친구 삭제' }, '친구 이름'));
    });
    act(() => {
      renderer.update(createElement(Dialog, { visible: false, onClose, title: '' }, null));
    });
    expect(renderer.root.findByType('Modal' as never).props.visible).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).toContain('친구 이름');
    act(() => {
      vi.advanceTimersByTime(240);
    });
    expect(renderer.root.findByType('Modal' as never).props.visible).toBe(false);
  });
});
