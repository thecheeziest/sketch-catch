import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/api/client';

export type PresenceStatus = 'ONLINE' | 'OFFLINE' | 'IN_GAME';

export type Friend = {
  friendshipId: string;
  userId: string;
  nickname: string;
  friendCode: string;
  characterId: string;
  presenceStatus: PresenceStatus;
};

export function useFriends() {
  return useQuery({
    queryKey: ['friends'],
    queryFn: () => apiGet<Friend[]>('/friends'),
    refetchInterval: 30_000, // D-06: 30초 polling으로 presence 반영
  });
}
