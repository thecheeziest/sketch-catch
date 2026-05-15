import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/api/client';

export type FriendRequest = {
  id: string;
  sender: {
    id: string;
    nickname: string;
    friendCode: string;
    characterId: string;
  };
  createdAt: string;
};

export function useFriendRequests() {
  return useQuery({
    queryKey: ['friends', 'requests'],
    queryFn: () => apiGet<FriendRequest[]>('/friends/requests'),
  });
}
