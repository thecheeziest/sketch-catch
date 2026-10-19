// 강제 업데이트 — 서버가 플랫폼별 최소 빌드 번호를 정하고, 미달 클라이언트는 진입·요청을 막는다.
// 버전 문자열(0.0.1)이 아니라 빌드 번호(iOS CFBundleVersion / Android versionCode)로 비교한다:
// TestFlight·내부 테스트 빌드는 버전은 그대로 두고 빌드 번호만 올리기 때문.

export type AppPlatform = 'ios' | 'android';

/** REST 요청 헤더 (소켓은 handshake.auth의 platform·build로 보낸다) */
export const APP_CLIENT_HEADER = {
  PLATFORM: 'x-app-platform',
  BUILD: 'x-app-build',
} as const;

export const UPDATE_REQUIRED_CODE = 'UPDATE_REQUIRED';

/** GET /app/version 응답 */
export type AppVersionInfo = {
  minBuild: number | null;
  /** 업데이트 받을 곳 (출시 전: TestFlight·내부 테스트 링크, 출시 후: 스토어 링크). 없으면 안내 문구만 표시 */
  updateUrl: string | null;
};

export function isAppBuildOutdated(build: number, minBuild: number | null): boolean {
  return minBuild !== null && Number.isFinite(build) && build < minBuild;
}
