import { useWindowDimensions } from 'react-native';
import { APP_MAX_WIDTH } from '@/shared/config';

/**
 * 앱 화면(AppFrame) 크기 — 창 폭이 APP_MAX_WIDTH보다 넓으면 그 폭으로 제한한다.
 * 화면 폭으로 크기를 계산하는 곳은 useWindowDimensions 대신 이 훅을 쓴다.
 */
export function useAppDimensions() {
  const window = useWindowDimensions();
  return { ...window, width: Math.min(window.width, APP_MAX_WIDTH) };
}
