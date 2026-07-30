import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// D-10: 포그라운드일 때 OS 배너 대신 기존 Toast를 재사용 — 모듈 스코프에서 배너 억제
// 설치된 expo-notifications@0.28.19는 shouldShowBanner/shouldShowList 분리 플래그를 지원하지 않음
// (RESEARCH A4 fallback) — 구버전 shouldShowAlert 형태 사용
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// SDK51-safe 권한 요청 + 토큰 조회 (RESEARCH Pattern 1)
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'android') {
    // Pitfall 2: Android 13+에서 채널 생성 전 권한 요청 시 프롬프트가 뜨지 않을 수 있음 — 반드시 먼저 생성
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  return token;
}
