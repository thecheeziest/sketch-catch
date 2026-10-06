import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

// Android 하드웨어 뒤로가기를 가로채 handler를 실행한다 (iOS 스와이프는 스택 gestureEnabled:false로 차단).
// 게임·대기실·시상식처럼 확인 없이 나가면 안 되는 화면에서 사용한다.
export function useHardwareBack(handler: () => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handlerRef.current();
      return true;
    });
    return () => subscription.remove();
  }, []);
}
