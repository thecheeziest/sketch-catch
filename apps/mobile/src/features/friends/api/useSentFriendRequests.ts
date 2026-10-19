import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/api';
import type { SentRequest } from '@/shared/model';

export type { SentRequest };

type Options = { subscribed?: boolean };

// subscribed=false면 캐시만 읽고 폴링하지 않는다 — 화면이 가려졌거나 모달이 닫혀 있을 때 통신을 멈추기 위함
export function useSentFriendRequests({ subscribed = true }: Options = {}) {
  return useQuery<SentRequest[]>({
    queryKey: ['friends', 'requests', 'sent'],
    queryFn: () => apiGet<SentRequest[]>('/friends/requests/sent'),
    refetchInterval: 30_000,
    subscribed,
  });
}
