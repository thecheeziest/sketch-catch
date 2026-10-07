import { isAppBuildOutdated, type AppPlatform, type AppVersionInfo } from '@sketch-catch/shared';
import { env } from './env.js';

function parsePlatform(value: unknown): AppPlatform | null {
  return value === 'ios' || value === 'android' ? value : null;
}

export function getAppVersionInfo(platform: AppPlatform): AppVersionInfo {
  if (platform === 'ios') {
    return { minBuild: env.MIN_BUILD_IOS ?? null, updateUrl: env.APP_UPDATE_URL_IOS ?? null };
  }
  return { minBuild: env.MIN_BUILD_ANDROID ?? null, updateUrl: env.APP_UPDATE_URL_ANDROID ?? null };
}

/**
 * 클라이언트가 보낸 플랫폼·빌드 번호가 최소 빌드에 못 미치는지.
 * 값을 보내지 않는 클라이언트(버전 확인 도입 전 빌드)는 막지 않는다 — 기존 설치본이 갑자기 전부 깨지지 않도록.
 */
export function isOutdatedClient(platform: unknown, build: unknown): boolean {
  const parsedPlatform = parsePlatform(platform);
  if (!parsedPlatform || build === undefined || build === null || build === '') return false;
  return isAppBuildOutdated(Number(build), getAppVersionInfo(parsedPlatform).minBuild);
}
