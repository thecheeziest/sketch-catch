import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  setSkipAnimation: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
  deleteItem: vi.fn(),
  check: vi.fn(),
  fetch: vi.fn(),
  reload: vi.fn(),
  apiGet: vi.fn(),
}));

vi.mock('react', async importOriginal => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: () => [null, mocks.setSkipAnimation],
  useEffect: (effect: () => void) => effect(),
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: mocks.getItem,
  setItemAsync: mocks.setItem,
  deleteItemAsync: mocks.deleteItem,
}));
vi.mock('expo-updates', () => ({
  isEnabled: true,
  updateId: 'current-update',
  checkForUpdateAsync: mocks.check,
  fetchUpdateAsync: mocks.fetch,
  reloadAsync: mocks.reload,
}));
vi.mock('@/shared/api', () => ({ apiGet: mocks.apiGet }));
vi.mock('@/shared/config', () => ({
  APP_CLIENT_INFO: { platform: 'ios', build: 3 },
  colors: { DARK_200: '#1E1C2C' },
  icons: { LOGO_SPLASH: 1 },
}));
vi.mock('@/shared/model', async () => import('@/shared/model/appUpdate'));

import { useAppUpdateStore } from '@/shared/model/appUpdate';
import { useAppVersionGate } from './useAppVersionGate';

describe('OTA splash lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('__DEV__', false);
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    useAppUpdateStore.setState({ status: 'checking', otaStatus: 'idle', splashIntroDone: false, updateUrl: null });
    mocks.getItem.mockResolvedValue(null);
    mocks.setItem.mockResolvedValue(undefined);
    mocks.deleteItem.mockResolvedValue(undefined);
    mocks.check.mockResolvedValue({ isAvailable: false });
    mocks.fetch.mockResolvedValue({ isNew: true, manifest: { id: 'next-update' } });
    mocks.reload.mockResolvedValue(undefined);
    mocks.apiGet.mockResolvedValue({ minBuild: 1, updateUrl: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('preserves the normal intro when there is no OTA', async () => {
    useAppVersionGate();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.setSkipAnimation).toHaveBeenCalledWith(false);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(useAppUpdateStore.getState().status).toBe('ok');
  });

  it('consumes a matching recent reload marker once', async () => {
    mocks.getItem.mockResolvedValueOnce(`current-update|${Date.now()}`);
    useAppVersionGate();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.setSkipAnimation).toHaveBeenLastCalledWith(true);
    expect(mocks.deleteItem).toHaveBeenCalledWith('ota_splash_reload');
    useAppVersionGate();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.setSkipAnimation).toHaveBeenLastCalledWith(false);
  });

  it.each([
    ['current-update', 60_001],
    ['other-update', 0],
  ])('does not skip the intro for an expired or mismatched marker (%s)', async (id, age) => {
    mocks.getItem.mockResolvedValue(`${id}|${Date.now() - age}`);
    useAppVersionGate();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.setSkipAnimation).toHaveBeenCalledWith(false);
    expect(mocks.deleteItem).toHaveBeenCalled();
  });

  it('shows downloading state and waits for the first intro before reloading', async () => {
    mocks.check.mockResolvedValue({ isAvailable: true });
    useAppVersionGate();
    await vi.advanceTimersByTimeAsync(0);
    expect(useAppUpdateStore.getState().otaStatus).toBe('downloading');
    expect(mocks.reload).not.toHaveBeenCalled();
    useAppUpdateStore.getState().finishSplashIntro();
    await vi.advanceTimersByTimeAsync(0);
    expect(useAppUpdateStore.getState().otaStatus).toBe('applying');
    expect(mocks.setItem).toHaveBeenCalledWith('ota_splash_reload', `next-update|${Date.now()}`);
    expect(mocks.reload).toHaveBeenCalledOnce();
    expect(mocks.apiGet).not.toHaveBeenCalled();
    expect(useAppUpdateStore.getState().status).toBe('checking');
  });

  it('clears the updating message after a download timeout and continues the build gate', async () => {
    mocks.check.mockResolvedValue({ isAvailable: true });
    mocks.fetch.mockImplementation(() => new Promise(() => {}));
    useAppVersionGate();
    await vi.advanceTimersByTimeAsync(8_001);
    expect(useAppUpdateStore.getState().otaStatus).toBe('idle');
    expect(useAppUpdateStore.getState().status).toBe('ok');
    expect(mocks.reload).not.toHaveBeenCalled();
  });

  it('clears the marker and updating message when reload fails', async () => {
    mocks.check.mockResolvedValue({ isAvailable: true });
    mocks.reload.mockRejectedValue(new Error('reload failed'));
    useAppUpdateStore.getState().finishSplashIntro();
    useAppVersionGate();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.deleteItem).toHaveBeenCalledWith('ota_splash_reload');
    expect(useAppUpdateStore.getState().otaStatus).toBe('idle');
    expect(useAppUpdateStore.getState().status).toBe('ok');
  });
});
