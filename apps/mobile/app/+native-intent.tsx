import { parsePushDeepLink } from '@sketch-catch/shared';
import { openPushDeepLink } from '@/features/push/lib/openPushDeepLink';

// 외부에서 연 앱 링크(sketchcatch:///invite/CODE 등)를 푸시 탭과 같은 흐름으로 처리한다.
// 라우터가 경로로 바로 이동하면 입장 확인·대기실 가드를 건너뛰므로 화면 이동은 막고 NotificationGate에 넘긴다.
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  // Scene이 SDK에서 처리한 인증 URL도 Linking에 전달한다. 인증 결과는 SDK에 맡기고 화면 이동만 막는다.
  const isKakaoCallback = /^(?:(?:sketchcatch|kakao[a-f0-9]{32}):\/\/\/?|\/)oauth\/?(?:[?#]|$)/i.test(path);
  if (isKakaoCallback) return initial ? '/' : null;

  const link = parsePushDeepLink(path);
  if (!link) return path;
  openPushDeepLink(link);
  // 콜드 스타트는 첫 화면이 필요하다 — 시작 경로로 보내면 로그인 여부에 따라 홈/로그인으로 간다
  return initial ? '/' : null;
}
