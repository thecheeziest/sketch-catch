import { create } from 'zustand';
import type { CoinReward, RoomState, UserPrivate } from '@sketch-catch/shared';
import { queryClient } from '@/shared/api';
import { useAuthStore, useRoomStore } from '@/shared/model';
import { ME_QUERY_KEY } from '@/features/auth/api';

type CoinRewardStore = {
  // 마지막 게임의 코인 정산 — 시상식·공개식 타이틀 코인 칩이 이 판의 gameId와 맞을 때만 보여준다
  reward: CoinReward | null;
  // 방 소켓에 정산 리스너를 1회 등록하고 해제 함수를 돌려준다 (room/[code]/_layout에서 호출)
  registerCoinRewardListeners: () => () => void;
};

export const useCoinRewardStore = create<CoinRewardStore>()(set => ({
  reward: null,

  registerCoinRewardListeners: () => {
    const socket = useRoomStore.getState().socket;
    if (!socket) return () => undefined;

    const handleReward = (reward: CoinReward): void => {
      set({ reward });
      // 홈 헤더 코인 칩이 다시 불러오지 않아도 새 잔액을 보이도록 내 정보 캐시를 맞춘다
      const me = queryClient.getQueryData<UserPrivate>(ME_QUERY_KEY);
      if (!me) return;
      const next = { ...me, coins: reward.balance };
      queryClient.setQueryData(ME_QUERY_KEY, next);
      useAuthStore.getState().setUser(next);
    };

    // 새 게임이 시작되면 지난 판 정산은 버린다
    const handleRoomState = (state: RoomState): void => {
      set(prev => (prev.reward && state.gameId && state.gameId !== prev.reward.gameId ? { reward: null } : prev));
    };

    socket.on('coin:reward', handleReward);
    socket.on('room:state', handleRoomState);
    return () => {
      socket.off('coin:reward', handleReward);
      socket.off('room:state', handleRoomState);
      set({ reward: null });
    };
  },
}));
