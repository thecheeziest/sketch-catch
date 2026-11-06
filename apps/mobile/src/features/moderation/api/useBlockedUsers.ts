import { useQuery } from '@tanstack/react-query';
import type { BlockedUser } from '@sketch-catch/shared';
import { apiGet } from '@/shared/api';
import { useAuthStore } from '@/shared/model';
import { moderationQueryKeys } from './queryKeys';

// 로그인한 유저만 조회한다 — 차단 목록은 내 기기에서 상대 채팅을 가릴 때도 쓰인다
export function useBlockedUsers() {
  const isSignedIn = useAuthStore(s => s.user !== null);
  return useQuery<BlockedUser[]>({
    queryKey: moderationQueryKeys.blocks,
    queryFn: () => apiGet<BlockedUser[]>('/blocks'),
    enabled: isSignedIn,
    staleTime: 60_000,
  });
}
