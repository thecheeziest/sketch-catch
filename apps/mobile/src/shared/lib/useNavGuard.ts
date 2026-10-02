import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

// router.push는 연타 시 같은 화면을 스택에 중복으로 쌓는다. 최초 탭만 통과시키고,
// 화면이 포커스를 잃은 뒤 다시 포커스를 얻을 때(뒤로가기 등) 잠금을 해제한다.
export function useNavGuard() {
  const lockedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      lockedRef.current = false;
    }, [])
  );

  return useCallback((action: () => void) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    action();
  }, []);
}
