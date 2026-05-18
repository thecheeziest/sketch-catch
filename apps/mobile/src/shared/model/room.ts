import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { io, type Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents, RoomState, Player } from '@sketch-catch/shared';
import { SOCKET_NAMESPACE } from '@sketch-catch/shared';
import { useAuthStore } from './auth';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

type RoomStore = {
  socket: Socket<ServerEvents, ClientEvents> | null;
  roomState: RoomState | null;
  isMatchmaking: boolean;
  matchingSeconds: number;
  connect: () => void;
  disconnect: () => void;
  setRoomState: (s: RoomState) => void;
  setMatchmaking: (on: boolean) => void;
  setMatchingSeconds: (n: number) => void;
};

export const useRoomStore = create<RoomStore>()(
  immer((set, get) => ({
    socket: null,
    roomState: null,
    isMatchmaking: false,
    matchingSeconds: 0,

    connect: () => {
      if (get().socket?.connected) return;
      const token = useAuthStore.getState().accessToken;
      const socket = io(`${BASE_URL}${SOCKET_NAMESPACE}`, {
        transports: ['websocket'], // Pitfall 1: RN에서 polling fallback 비활성화 필수
        auth: { token },
      });

      // 이벤트명 리터럴 직접 사용 — SERVER_EVENT 상수를 통한 타입 추론이 socket.on 오버로드와 불일치 (D-04-04)
      socket.on('room:state', (s) => get().setRoomState(s));
      socket.on('room:player:join', ({ player }: { player: Player }) =>
        set((st) => {
          if (st.roomState && !st.roomState.players.some((p) => p.id === player.id)) {
            st.roomState.players.push(player);
          }
        })
      );
      socket.on('room:player:leave', ({ userId }: { userId: string }) =>
        set((st) => {
          if (st.roomState) {
            st.roomState.players = st.roomState.players.filter((p) => p.id !== userId);
          }
        })
      );

      set((st) => {
        st.socket = socket as unknown as typeof st.socket;
      });
    },

    disconnect: () => {
      get().socket?.disconnect();
      set((st) => {
        st.socket = null;
        st.roomState = null;
      });
    },

    setRoomState: (s) =>
      set((st) => {
        st.roomState = s;
      }),

    setMatchmaking: (on) =>
      set((st) => {
        st.isMatchmaking = on;
        if (!on) st.matchingSeconds = 0;
      }),

    setMatchingSeconds: (n) =>
      set((st) => {
        st.matchingSeconds = n;
      }),
  }))
);
