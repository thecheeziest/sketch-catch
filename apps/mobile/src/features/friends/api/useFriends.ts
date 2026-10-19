import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/api';
import type { Friend } from '@/shared/model';

export type { Friend };

type Options = { subscribed?: boolean };

// subscribed=false면 캐시만 읽고 폴링하지 않는다 — 화면이 가려졌거나 모달이 닫혀 있을 때 통신을 멈추기 위함
export function useFriends({ subscribed = true }: Options = {}) {
  return useQuery<Friend[]>({
    queryKey: ['friends'],
    queryFn: () => apiGet<Friend[]>('/friends'),
    refetchInterval: 5_000,
    subscribed,
  });
}
