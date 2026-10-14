import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

const cue = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/feedback', () => ({ playFeedback: cue }));
vi.mock('react-native', () => ({ Pressable: 'Pressable' }));
import { FeedbackPressable } from './index';

let renderer: ReactTestRenderer;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  act(() => renderer?.unmount());
  vi.clearAllMocks();
});

describe('공통 터치 피드백', () => {
  it('활성 버튼은 이벤트를 전달하며 피드백을 한 번만 실행한다', () => {
    const onPress = vi.fn();
    act(() => {
      renderer = create(createElement(FeedbackPressable, { onPress, feedback: 'cancel' }));
    });
    const event = { nativeEvent: { pageX: 1, pageY: 1 } };
    act(() => renderer.root.findByType('Pressable' as never).props.onPress(event));
    expect(cue).toHaveBeenCalledOnce();
    expect(cue).toHaveBeenCalledWith('cancel');
    expect(onPress).toHaveBeenCalledWith(event);
  });
  it('비활성 버튼은 사운드·햅틱과 사용자 동작을 실행하지 않는다', () => {
    const onPress = vi.fn();
    act(() => {
      renderer = create(createElement(FeedbackPressable, { onPress, disabled: true }));
    });
    act(() => renderer.root.findByType('Pressable' as never).props.onPress({}));
    expect(cue).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });
  it('서버 결과에 피드백을 맡긴 버튼은 기본 클릭음만 생략하고 동작은 유지한다', () => {
    const onPress = vi.fn();
    act(() => {
      renderer = create(createElement(FeedbackPressable, { onPress, feedback: false }));
    });
    act(() => renderer.root.findByType('Pressable' as never).props.onPress({}));
    expect(cue).not.toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledOnce();
  });
});
