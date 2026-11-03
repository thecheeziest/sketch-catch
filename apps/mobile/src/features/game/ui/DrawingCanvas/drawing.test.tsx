import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gestures = vi.hoisted(() => ({ begin: (_event: { x: number; y: number }) => {}, end: () => {} }));
vi.mock('react-native', () => ({
  StyleSheet: { create: (s: object) => s },
  useWindowDimensions: () => ({ width: 360 }),
}));
vi.mock('dripsy', () => ({ View: 'View' }));
vi.mock('@shopify/react-native-skia', () => ({ Canvas: 'Canvas', Path: 'Path' }));
vi.mock('react-native-gesture-handler', () => ({
  GestureDetector: 'GestureDetector',
  Gesture: {
    Pan: () => {
      const pan = {
        runOnJS: () => pan,
        minDistance: () => pan,
        onBegin: (fn: typeof gestures.begin) => {
          gestures.begin = fn;
          return pan;
        },
        onUpdate: () => pan,
        onEnd: (fn: typeof gestures.end) => {
          gestures.end = fn;
          return pan;
        },
      };
      return pan;
    },
  },
}));
vi.mock('@/shared/config', () => ({ colors: { DARK_500: '#14101C' } }));
vi.mock('@/shared/model/room', () => ({ useRoomStore: { getState: () => ({ socket: null }) } }));
vi.mock('@/shared/model/auth', () => ({
  useAuthStore: Object.assign(() => 'me', { getState: () => ({ user: { id: 'me' } }) }),
}));
vi.mock('@/shared/model/toast', () => ({ useToastStore: { getState: () => ({ show: vi.fn() }) } }));
vi.mock('@/shared/lib/feedback', () => ({ playFeedback: vi.fn() }));
vi.mock('@/shared/lib/strokePath', () => ({ buildStrokePath: () => ({}), buildPaintPath: () => ({}) }));
vi.mock('@/features/game/api/useStrokeSender', () => ({
  useStrokeSender: () => ({ startStroke: vi.fn(), endStroke: vi.fn(), pushPoint: vi.fn(), fill: vi.fn() }),
}));
import { useGameStore } from '@/features/game/model/useGameStore';
import { DrawingCanvas } from './index';

let renderer: ReactTestRenderer;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
beforeEach(() => useGameStore.getState().reset());
afterEach(() => act(() => renderer?.unmount()));
function draw(): void {
  act(() => {
    gestures.begin({ x: 20, y: 20 });
    gestures.end();
  });
}
function strokeCount(): number {
  return renderer.root.findAllByType('Path' as never).length;
}

describe('캔버스 입력 회귀', () => {
  it('시작 직후 바꾼 색과 굵기가 첫 획부터 적용된다', () => {
    act(() => {
      renderer = create(createElement(DrawingCanvas, { isDrawer: true }));
    });
    act(() => {
      useGameStore.getState().setColor('#FF0000');
      useGameStore.getState().setWidth(12);
    });
    draw();
    expect(renderer.root.findByType('Path' as never).props).toMatchObject({ color: '#FF0000', strokeWidth: 12 });
  });
  it('연속 되돌리기는 한 획씩, 콜백 변경·새 캔버스에서는 이전 클릭을 재실행하지 않는다', () => {
    act(() => {
      renderer = create(createElement(DrawingCanvas, { isDrawer: true, onStrokesChange: vi.fn() }));
    });
    draw();
    draw();
    draw();
    expect(strokeCount()).toBe(3);
    act(() => useGameStore.getState().requestDrawerUndo());
    expect(strokeCount()).toBe(2);
    act(() => renderer.update(createElement(DrawingCanvas, { isDrawer: true, onStrokesChange: vi.fn() })));
    expect(strokeCount()).toBe(2);
    act(() => useGameStore.getState().requestDrawerUndo());
    expect(strokeCount()).toBe(1);
    act(() => useGameStore.getState().requestDrawerClear());
    expect(strokeCount()).toBe(0);
    draw();
    expect(strokeCount()).toBe(1);
    act(() =>
      renderer.update(createElement(DrawingCanvas, { key: 'next-step', isDrawer: true, onStrokesChange: vi.fn() })),
    );
    draw();
    expect(strokeCount()).toBe(1);
  });
});
