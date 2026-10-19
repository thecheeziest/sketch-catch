import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/api';
import type { FriendRequest } from '@/shared/model';

export type { FriendRequest };

type Options = { subscribed?: boolean };

// subscribed=false면 캐시만 읽고 폴링하지 않는다 — 화면이 가려졌거나 모달이 닫혀 있을 때 통신을 멈추기 위함
export function useFriendRequests({ subscribed = true }: Options = {}) {
  return useQuery<FriendRequest[]>({
    queryKey: ['friends', 'requests'],
    queryFn: () => apiGet<FriendRequest[]>('/friends/requests'),
    refetchInterval: 30_000,
    subscribed,
  });
}
