import { useEffect } from 'react';
import * as Updates from 'expo-updates';
import { isAppBuildOutdated, type AppVersionInfo } from '@sketch-catch/shared';
import { apiGet } from '@/shared/api';
import { APP_CLIENT_INFO } from '@/shared/config';
import { useAppUpdateStore } from '@/shared/model';

// 스플래시가 버전 확인 때문에 끝없이 붙잡히지 않도록 단계마다 시간 제한을 둔다
const OTA_TIMEOUT_MS = 8_000;
const VERSION_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// 새 OTA(JS 번들)가 있으면 받아서 바로 재시작 — 바이너리는 같아도 JS가 서버와 어긋나지 않도록
async function applyLatestOta(): Promise<void> {
  if (__DEV__ || !Updates.isEnabled) return;
  const check = await withTimeout(Updates.checkForUpdateAsync(), OTA_TIMEOUT_MS);
  if (!check.isAvailable) return;
  const fetched = await withTimeout(Updates.fetchUpdateAsync(), OTA_TIMEOUT_MS);
  if (fetched.isNew) await Updates.reloadAsync();
}

async function fetchVersionInfo(): Promise<AppVersionInfo> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERSION_TIMEOUT_MS);
  try {
    return await apiGet<AppVersionInfo>(`/app/version?platform=${APP_CLIENT_INFO.platform}`, {
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 앱 시작 시 1회: 최신 OTA 적용 → 서버 최소 빌드와 비교.
 * 미달이면 업데이트 화면으로 막고, 확인 자체가 실패하면(서버 장애 등) 진입은 허용한다 —
 * 이후 API·소켓 요청에서 서버가 426/UPDATE_REQUIRED로 다시 막는다.
 */
export function useAppVersionGate() {
  useEffect(() => {
    const run = async (): Promise<void> => {
      try {
        await applyLatestOta();
      } catch (err) {
        console.log('[appUpdate] OTA check skipped', err);
      }

      try {
        const info = await fetchVersionInfo();
        if (isAppBuildOutdated(APP_CLIENT_INFO.build, info.minBuild)) {
          useAppUpdateStore.getState().requireUpdate(info.updateUrl);
        } else {
          useAppUpdateStore.getState().setChecked(info.updateUrl);
        }
      } catch (err) {
        console.log('[appUpdate] version check failed', err);
        useAppUpdateStore.getState().setChecked(null);
      }
    };
    void run();
  }, []);
}
