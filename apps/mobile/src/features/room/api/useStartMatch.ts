import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { apiPost } from '@/shared/api';
import { useRoomStore } from '@/shared/model';

type MatchResponse = { matched: boolean; code?: string };

export function useStartMatch() {
  const router = useRouter();

  return useMutation({
    mutationFn: (playerCount: 6 | 8 | 10) =>
      apiPost<MatchResponse>('/match', { playerCount }),
    onSuccess: ({ matched, code }) => {
      if (matched && code) {
        // 즉시 매칭 성공: 대기실로 이동
        router.push(`/room/${code}`);
      } else {
        // 대기 상태: 호출부(화면)에서 isMatchmaking 관찰 후 UI 전환
        useRoomStore.getState().setMatchmaking(true);
      }
    },
  });
}
