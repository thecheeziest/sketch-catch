import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useRoomStore } from '@/shared/model';

// 매칭 로비의 카운트다운이 끝나 서버가 match:found를 push하면(matchFoundCode) 방으로 이동한다.
// room:state는 room:join 이벤트 이후에만 오므로, 매칭 대기 화면에서는 코드만으로 네비게이션한다.
export function useMatchingNavigation(): void {
  const router = useRouter();
  const code = useRoomStore((s) => s.matchFoundCode);

  useEffect(() => {
    if (!code) return;
    useRoomStore.getState().setMatchmaking(false);
    useRoomStore.getState().setMatchFoundCode(null);
    router.replace(`/room/${code}`);
  }, [code]);
}
