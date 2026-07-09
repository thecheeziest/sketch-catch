import { useAuthStore, type UserPrivate } from '@/shared/model';

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  needsOnboarding: boolean;
  user: UserPrivate;
};

// needsOnboarding을 먼저 세팅해야 setTokens(isAuthenticated=true) 시점에 _layout redirect가 올바르게 동작함
export async function initializeAuthState(data: AuthResponse): Promise<{ needsOnboarding: boolean }> {
  const store = useAuthStore.getState();
  store.setNeedsOnboarding(data.needsOnboarding);
  await store.setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  store.setUser(data.user);
  return { needsOnboarding: data.needsOnboarding };
}
