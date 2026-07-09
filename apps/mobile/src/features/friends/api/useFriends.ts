import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/api';
import type { Friend } from '@/shared/model';

export type { Friend };

export function useFriends() {
  return useQuery<Friend[]>({
    queryKey: ['friends'],
    queryFn: () => apiGet<Friend[]>('/friends'),
    refetchInterval: 5_000,
  });
}
