import { useEffect, useState } from 'react';
import { Keyboard, Platform, useWindowDimensions, type KeyboardEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 콘텐츠 높이를 키보드와 독립시켜 캔버스를 재측정하거나 압축하지 않는다.
export function useGameKeyboardLayout() {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [viewportHeight, setViewportHeight] = useState(window.height);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);

  useEffect(() => {
    const show = (event: KeyboardEvent): void => {
      if (Platform.OS === 'ios') Keyboard.scheduleLayoutAnimation(event);
      setKeyboardTop(event.endCoordinates.screenY);
    };
    const hide = (event: KeyboardEvent): void => {
      if (Platform.OS === 'ios') Keyboard.scheduleLayoutAnimation(event);
      setKeyboardTop(null);
    };
    const shown = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow', show);
    const hidden = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', hide);
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const keyboardOffset = keyboardTop === null ? 0 : Math.max(0, viewportHeight - keyboardTop - insets.bottom);
  return {
    keyboardVisible: keyboardTop !== null && keyboardOffset > 0,
    keyboardOffset,
    contentHeight: Math.max(1, viewportHeight - insets.top - insets.bottom),
    onViewportLayout: (height: number): void => {
      // 세로 고정 앱: Android adjustResize가 didShow보다 먼저 도착해도 축소된 높이를 채택하지 않는다.
      if (keyboardTop === null && height > 0) setViewportHeight(previous => Math.max(previous, height));
    },
  };
}
