import { describe, it, expect, beforeEach, vi } from 'vitest';

// expo-secure-store mock — Map 기반 메모리 stub
const secureStoreMock = {
  data: new Map<string, string>(),
};

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn((key: string) =>
    Promise.resolve(secureStoreMock.data.get(key) ?? null)
  ),
  setItemAsync: vi.fn((key: string, value: string) => {
    secureStoreMock.data.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((key: string) => {
    secureStoreMock.data.delete(key);
    return Promise.resolve();
  }),
}));

// shared/model → 소켓 스토어가 앱 빌드 정보(expo-application, 네이티브 모듈)를 읽는다
vi.mock('expo-application', () => ({ nativeBuildVersion: '1' }));

import { useAuthStore, hydrateAuthStore, SECURE_STORE_KEYS } from '@/shared/model';
import * as SecureStore from 'expo-secure-store';

const initialState = {
  isLoaded: false,
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  user: null,
};

describe('auth store', () => {
  beforeEach(() => {
    secureStoreMock.data.clear();
    vi.clearAllMocks();
    useAuthStore.setState(initialState);
  });

  it('initial state has isLoaded=false and isAuthenticated=false', () => {
    const state = useAuthStore.getState();
    expect(state.isLoaded).toBe(false);
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it('setTokens persists access and refresh to SecureStore and sets isAuthenticated=true', async () => {
    await useAuthStore.getState().setTokens({ accessToken: 'access-token-1', refreshToken: 'refresh-token-1' });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(SECURE_STORE_KEYS.ACCESS, 'access-token-1');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(SECURE_STORE_KEYS.REFRESH, 'refresh-token-1');

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('access-token-1');
    expect(state.refreshToken).toBe('refresh-token-1');
    expect(state.isAuthenticated).toBe(true);
  });

  it('clearAuth deletes both SecureStore keys and resets state', async () => {
    await useAuthStore.getState().setTokens({ accessToken: 'a', refreshToken: 'r' });
    vi.clearAllMocks();

    await useAuthStore.getState().clearAuth();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(SECURE_STORE_KEYS.ACCESS);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(SECURE_STORE_KEYS.REFRESH);

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it('hydrateAuthStore reads tokens from SecureStore and sets isAuthenticated=true if access exists', async () => {
    secureStoreMock.data.set(SECURE_STORE_KEYS.ACCESS, 'stored-access');
    secureStoreMock.data.set(SECURE_STORE_KEYS.REFRESH, 'stored-refresh');

    await hydrateAuthStore();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('stored-access');
    expect(state.refreshToken).toBe('stored-refresh');
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoaded).toBe(true);
  });

  it('AUTH-05: hydration with both tokens missing leaves isAuthenticated=false', async () => {
    // secureStoreMock.data is empty
    await hydrateAuthStore();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoaded).toBe(true);
    expect(state.accessToken).toBeNull();
  });
});
