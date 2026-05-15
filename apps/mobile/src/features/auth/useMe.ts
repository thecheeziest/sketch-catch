import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/services/api';
import { useAuthStore, type UserPrivate } from '@/stores/auth';

export const ME_QUERY_KEY = ['me'] as const;

export function useMe() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery<UserPrivate>({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      const user = await apiGet<UserPrivate>('/me');
      useAuthStore.getState().setUser(user);
      return user;
    },
    // clearAuth 후 isAuthenticated=false → query 자동 비활성화
    enabled: isAuthenticated,
  });
}
