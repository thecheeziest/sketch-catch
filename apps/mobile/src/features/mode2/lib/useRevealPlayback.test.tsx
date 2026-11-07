import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mode2RevealEntry } from '@sketch-catch/shared';
import { useRevealScene, type RevealScene } from './useRevealPlayback';

let renderer: ReactTestRenderer;
let scene: RevealScene;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
function Player({ entries, startedAt }: { entries: Mode2RevealEntry[]; startedAt: number }) {
  scene = useRevealScene(entries, startedAt, id => `닉네임${id}`);
  return null;
}
function entries(authorId: string): Mode2RevealEntry[] {
  return [{ isOwner: true, authorId, text: '고양이', strokes: [] }];
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
});
afterEach(() => {
  act(() => renderer?.unmount());
  vi.useRealTimers();
});

describe('공개식 다시보기', () => {
  it('완성 장면의 캐릭터를 바꿔도 같은 컴포넌트에서 새 타임라인으로 재생한다', () => {
    act(() => {
      renderer = create(createElement(Player, { entries: entries('1'), startedAt: Number.NEGATIVE_INFINITY }));
    });
    expect(scene.painterText).toBe('닉네임1의 그림은.. 고양이!');
    act(() => renderer.update(createElement(Player, { entries: entries('2'), startedAt: Date.now() })));
    expect(scene.phase).toBe('wait');
    expect(scene.painterId).toBe('2');
    act(() => { vi.advanceTimersByTime(3500); });
    expect(scene.painterText).toBe('닉네임2의 그림은.. 고양이!');
    expect(scene.phase).toBe('draw');
    act(() => renderer.update(createElement(Player, { entries: entries('3'), startedAt: Date.now() })));
    expect(scene.phase).toBe('wait');
    expect(scene.painterText).toBe('');
  });
});
