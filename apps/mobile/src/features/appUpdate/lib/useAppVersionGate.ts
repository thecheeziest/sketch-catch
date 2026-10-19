import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';
import { isAppBuildOutdated, type AppVersionInfo } from '@sketch-catch/shared';
import { apiGet } from '@/shared/api';
import { APP_CLIENT_INFO, colors, icons } from '@/shared/config';
import { useAppUpdateStore } from '@/shared/model';

// 스플래시가 버전 확인 때문에 끝없이 붙잡히지 않도록 단계마다 시간 제한을 둔다
const OTA_TIMEOUT_MS = 8_000;
const VERSION_TIMEOUT_MS = 5_000;
const OTA_RELOAD_KEY = 'ota_splash_reload';
const OTA_RELOAD_TTL_MS = 60_000;

async function consumeOtaReload(): Promise<boolean> {
  const marker = await SecureStore.getItemAsync(OTA_RELOAD_KEY);
  if (!marker) return false;
  await SecureStore.deleteItemAsync(OTA_RELOAD_KEY);
  const [updateId, timestamp] = marker.split('|');
  const elapsed = Date.now() - Number(timestamp);
  return updateId === Updates.updateId && elapsed >= 0 && elapsed < OTA_RELOAD_TTL_MS;
}

function waitForSplashIntro(): Promise<void> {
  if (useAppUpdateStore.getState().splashIntroDone) return Promise.resolve();
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve();
    }, OTA_TIMEOUT_MS);
    const unsubscribe = useAppUpdateStore.subscribe(state => {
      if (!state.splashIntroDone) return;
      clearTimeout(timer);
      unsubscribe();
      resolve();
    });
  });
}

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
async function applyLatestOta(): Promise<boolean> {
  if (__DEV__ || !Updates.isEnabled) return false;
  const check = await withTimeout(Updates.checkForUpdateAsync(), OTA_TIMEOUT_MS);
  if (!check.isAvailable) return false;
  useAppUpdateStore.getState().setOtaStatus('downloading');
  const fetched = await withTimeout(Updates.fetchUpdateAsync(), OTA_TIMEOUT_MS);
  if (!fetched.isNew) {
    useAppUpdateStore.getState().setOtaStatus('idle');
    return false;
  }
  await waitForSplashIntro();
  useAppUpdateStore.getState().setOtaStatus('applying');
  try {
    await withTimeout(
      SecureStore.setItemAsync(OTA_RELOAD_KEY, `${fetched.manifest.id}|${Date.now()}`),
      VERSION_TIMEOUT_MS,
    );
  } catch (err) {
    console.log('[appUpdate] OTA splash marker unavailable', err);
  }
  try {
    await Updates.reloadAsync({
      reloadScreenOptions: {
        backgroundColor: colors.DARK_200,
        image: icons.LOGO_SPLASH,
        imageResizeMode: 'contain',
        imageFullScreen: true,
        spinner: { enabled: false },
      },
    });
    return true;
  } catch (err) {
    await withTimeout(SecureStore.deleteItemAsync(OTA_RELOAD_KEY), VERSION_TIMEOUT_MS).catch(() => undefined);
    throw err;
  }
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
  const [skipSplashAnimation, setSkipSplashAnimation] = useState<boolean | null>(null);
  useEffect(() => {
    const run = async (): Promise<void> => {
      try {
        setSkipSplashAnimation(await withTimeout(consumeOtaReload(), VERSION_TIMEOUT_MS));
      } catch (err) {
        console.log('[appUpdate] OTA splash marker skipped', err);
        setSkipSplashAnimation(false);
      }
      try {
        const isReloading = await applyLatestOta();
        if (isReloading) return;
      } catch (err) {
        console.log('[appUpdate] OTA check skipped', err);
        useAppUpdateStore.getState().setOtaStatus('idle');
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
  return { skipSplashAnimation };
}
