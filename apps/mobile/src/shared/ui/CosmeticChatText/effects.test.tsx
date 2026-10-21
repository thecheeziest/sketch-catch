import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getShopItem } from '@sketch-catch/shared';

vi.mock('@assets/fonts/Galmuri11.ttf', () => ({ default: 1 }));
vi.mock('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas',
  Group: 'Group',
  Paragraph: 'Paragraph',
  BlendMode: {},
  PaintStyle: {},
  Skia: {},
  TileMode: {},
  useFonts: () => null,
  vec: () => ({}),
}));
vi.mock('dripsy', () => ({ Text: 'Text', View: 'View' }));
vi.mock('@react-native-masked-view/masked-view', () => ({ default: 'MaskedView' }));
vi.mock('react-native', () => ({
  useWindowDimensions: () => ({ fontScale: 1 }),
  StyleSheet: { flatten: () => ({ fontSize: 13 }), create: (styles: unknown) => styles, absoluteFill: {} },
}));
vi.mock('@/shared/config', () => ({
  colors: { LIGHT_100: '#FFFFFF' },
  fontFamily: { REGULAR: 'Galmuri11' },
  getChatItem: (id: string) => getShopItem(id),
}));
import { CosmeticChatText } from './index';

let renderer: ReactTestRenderer;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => act(() => renderer?.unmount()));
const message = '긴 채팅 글자 다람쥐인가요? 👨‍👩‍👧‍👦🎨';

describe('전설 채팅 효과의 의미 보존', () => {
  it('겹친 모든 글자에 동일한 한글·결합 이모지를 전달하고 한 번만 읽는다', () => {
    act(() => {
      renderer = create(createElement(CosmeticChatText, { itemId: 'chat_legend_candy', children: message }));
    });
    const texts = renderer.root.findAllByType('Text' as never);
    expect(texts.length).toBeGreaterThan(1);
    expect(texts.every(text => text.props.children === message && text.props.accessible === false)).toBe(true);
    const labels = renderer.root.findAll(node => node.props.accessibilityLabel === message);
    expect(labels).toHaveLength(1);
    expect(labels[0]?.props.accessible).toBe(true);
  });
  it('정답 강조색을 지정하면 전설 외곽선·색 띠를 적용하지 않는다', () => {
    act(() => {
      renderer = create(
        createElement(CosmeticChatText, { itemId: 'chat_legend_rainbow', color: '#00FF00', children: message }),
      );
    });
    expect(renderer.root.findAllByType('Text' as never)).toHaveLength(1);
    expect(renderer.root.findAllByType('MaskedView' as never)).toHaveLength(0);
    expect(renderer.root.findByType('Text' as never).props.style.at(-1)).toEqual({ color: '#00FF00' });
  });
  it('일반 상품에는 겹친 레이어를 만들지 않는다', () => {
    act(() => {
      renderer = create(createElement(CosmeticChatText, { itemId: 'chat_pink', children: message }));
    });
    expect(renderer.root.findAllByType('Text' as never)).toHaveLength(1);
  });
  it('레인보우는 단일 접근성 라벨과 투명 캔버스를 사용한다', () => {
    act(() => {
      renderer = create(createElement(CosmeticChatText, { itemId: 'chat_legend_rainbow', children: message }));
    });
    expect(renderer.root.findAllByType('Canvas' as never)).toHaveLength(1);
    expect(renderer.root.findAllByType('MaskedView' as never)).toHaveLength(0);
    expect(renderer.root.findAll(node => node.props.accessibilityLabel === message)).toHaveLength(1);
    const measurement = renderer.root.findAllByType('Text' as never).find(node => node.props.onTextLayout);
    expect(measurement?.props.style.at(-1)).toEqual({ color: 'transparent' });
    expect(renderer.root.findAllByType('Text' as never).some(node => node.props.children === '👨‍👩‍👧‍👦')).toBe(true);
  });
});
