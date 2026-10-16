import { useCallback } from 'react';
import { useRegisterPushToken } from '../api/useRegisterPushToken';
import { registerForPushNotificationsAsync } from './registerForPushNotificationsAsync';

// 권한 요청 → 토큰 발급 → 서버 등록. 권한이 없거나 등록에 실패하면 false
export function usePushRegistration() {
  const { mutateAsync } = useRegisterPushToken();

  return useCallback(async (): Promise<boolean> => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (!token) {
        console.warn('[push] 토큰 없음: 알림 권한 거부');
        return false;
      }
      await mutateAsync({ token });
      return true;
    } catch (error) {
      console.warn('[push] 토큰 등록 실패', error);
      return false;
    }
  }, [mutateAsync]);
}
