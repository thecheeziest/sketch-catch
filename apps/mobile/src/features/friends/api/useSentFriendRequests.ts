import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/api';
import type { SentRequest } from '@/shared/model';

export type { SentRequest };

export function useSentFriendRequests() {
  return useQuery<SentRequest[]>({
    queryKey: ['friends', 'requests', 'sent'],
    queryFn: () => apiGet<SentRequest[]>('/friends/requests/sent'),
    refetchInterval: 30_000,
  });
}
