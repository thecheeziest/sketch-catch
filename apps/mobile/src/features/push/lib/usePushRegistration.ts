import { useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiPost } from '@/shared/api';
import { useRegisterPushToken } from '../api/useRegisterPushToken';
import { registerForPushNotificationsAsync } from './registerForPushNotificationsAsync';

type DiagnosticResult = 'registered' | 'denied' | 'error';

// 릴리스 빌드는 앱 콘솔을 볼 수 없어 등록 결과를 서버 로그로 남긴다 (실패해도 흐름에 영향 없음)
async function reportDiagnostic(result: DiagnosticResult, message?: string): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    await apiPost('/me/push-diagnostic', { result, permission: status, message, platform: Platform.OS });
  } catch {
    // ignore — 진단 전송 실패는 무시
  }
}

// 권한 요청 → 토큰 발급 → 서버 등록. 권한이 없거나 등록에 실패하면 false
export function usePushRegistration() {
  const { mutateAsync } = useRegisterPushToken();

  return useCallback(async (): Promise<boolean> => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (!token) {
        console.warn('[push] 토큰 없음: 알림 권한 거부');
        void reportDiagnostic('denied');
        return false;
      }
      await mutateAsync({ token });
      void reportDiagnostic('registered');
      return true;
    } catch (error) {
      console.warn('[push] 토큰 등록 실패', error);
      void reportDiagnostic('error', error instanceof Error ? error.message : String(error));
      return false;
    }
  }, [mutateAsync]);
}
