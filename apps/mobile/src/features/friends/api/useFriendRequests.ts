import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/api';
import type { FriendRequest } from '@/shared/model';

export type { FriendRequest };

export function useFriendRequests() {
  return useQuery<FriendRequest[]>({
    queryKey: ['friends', 'requests'],
    queryFn: () => apiGet<FriendRequest[]>('/friends/requests'),
    refetchInterval: 30_000,
  });
}
