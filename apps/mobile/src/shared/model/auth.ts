import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import * as SecureStore from 'expo-secure-store';

export const SECURE_STORE_KEYS = {
  ACCESS: 'sketch_catch_access',
  REFRESH: 'sketch_catch_refresh',
} as const;

// RN 측 import 단순화를 위해 명시 타입 정의 (packages/shared z.infer 대신)
export type UserPrivate = {
  id: string;
  nickname: string;
  friendCode: string;
  characterId: string;
  provider: 'KAKAO' | 'APPLE';
  createdAt: string;
  nicknameChangedAt: string | null;
};

type AuthState = {
  isLoaded: boolean;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: UserPrivate | null;
};

type AuthActions = {
  setTokens: (tokens: { accessToken: string; refreshToken?: string }) => Promise<void>;
  setUser: (user: UserPrivate) => void;
  setNeedsOnboarding: (value: boolean) => void;
  clearAuth: () => Promise<void>;
  setLoaded: () => void;
};

export const useAuthStore = create<AuthState & AuthActions>()(
  immer((set) => ({
    isLoaded: false,
    isAuthenticated: false,
    needsOnboarding: false,
    accessToken: null,
    refreshToken: null,
    user: null,

    setTokens: async ({ accessToken, refreshToken }) => {
      await SecureStore.setItemAsync(SECURE_STORE_KEYS.ACCESS, accessToken);
      if (refreshToken) {
        await SecureStore.setItemAsync(SECURE_STORE_KEYS.REFRESH, refreshToken);
      }
      set((s) => {
        s.accessToken = accessToken;
        if (refreshToken) s.refreshToken = refreshToken;
        s.isAuthenticated = true;
      });
    },

    setUser: (user) => {
      set((s) => {
        s.user = user;
      });
    },

    setNeedsOnboarding: (value) => {
      set((s) => {
        s.needsOnboarding = value;
      });
    },

    clearAuth: async () => {
      await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS);
      await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH);
      set((s) => {
        s.accessToken = null;
        s.refreshToken = null;
        s.user = null;
        s.isAuthenticated = false;
        s.needsOnboarding = false;
      });
    },

    setLoaded: () => {
      set((s) => {
        s.isLoaded = true;
      });
    },
  }))
);

/**
 * 앱 시작 시 SecureStore에서 토큰을 읽어 Zustand 상태로 복원한다 (AUTH-05).
 * store action이 아닌 외부 함수로 정의 — 앱 루트 레이아웃에서 useEffect로 호출.
 */
export async function hydrateAuthStore(): Promise<void> {
  const [access, refresh] = await Promise.all([
    SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS),
    SecureStore.getItemAsync(SECURE_STORE_KEYS.REFRESH),
  ]);

  useAuthStore.setState({
    accessToken: access,
    refreshToken: refresh,
    isAuthenticated: !!access,
    isLoaded: true,
  });
}
