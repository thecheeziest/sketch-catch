import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { io, type Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents, RoomState, Player } from '@sketch-catch/shared';
import { SOCKET_NAMESPACE } from '@sketch-catch/shared';
import { useAuthStore } from './auth';
import { useToastStore } from './toast';
import { refreshAccessToken } from '../api/client';
import { Platform } from 'react-native';

// Android 에뮬레이터는 10.0.2.2로 호스트 머신에 접근 (api/client.ts와 동일 패턴)
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace('localhost', DEV_HOST);

type MatchLobby = {
  mode: 1 | 2;
  count: number;
  min: number;
  max: number;
  deadline: number | null; // epoch ms. null = 아직 최소 인원 미달(카운트다운 시작 전)
};

type RoomStore = {
  socket: Socket<ServerEvents, ClientEvents> | null;
  roomState: RoomState | null;
  isMatchmaking: boolean;
  matchingSeconds: number;
  matchLobby: MatchLobby | null;
  matchFoundCode: string | null;
  connect: () => void;
  disconnect: () => void;
  setRoomState: (s: RoomState) => void;
  setMatchmaking: (on: boolean) => void;
  setMatchingSeconds: (n: number) => void;
  setMatchLobby: (s: MatchLobby | null) => void;
  setMatchFoundCode: (code: string | null) => void;
};

export const useRoomStore = create<RoomStore>()(
  immer((set, get) => ({
    socket: null,
    roomState: null,
    isMatchmaking: false,
    matchingSeconds: 0,
    matchLobby: null,
    matchFoundCode: null,

    connect: () => {
      if (get().socket?.connected) return;
      const socket = io(`${BASE_URL}${SOCKET_NAMESPACE}`, {
        transports: ['websocket'], // Pitfall 1: RN에서 polling fallback 비활성화 필수
        // 재연결마다 스토어의 최신 accessToken을 읽는다 — 만료된 토큰 재사용 방지
        auth: (cb) => cb({ token: useAuthStore.getState().accessToken ?? '' }),
      });

      // accessToken 만료로 인증 실패 시 1회 갱신 후 재연결. connect 성공 시 초기화된다.
      let didRefreshAuth = false;
      socket.on('connect', () => {
        didRefreshAuth = false;
      });
      socket.on('connect_error', (err) => {
        console.error('[socket] connect_error', err.message);
        const isAuthError = err.message === 'INVALID_TOKEN' || err.message === 'UNAUTHORIZED';
        if (!isAuthError || didRefreshAuth) return;
        didRefreshAuth = true;
        void refreshAccessToken().then((newToken) => {
          if (newToken) socket.connect();
        });
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
          if (!st.roomState) return;
          st.roomState.players = st.roomState.players.filter((p) => p.id !== userId);
          // hostId는 room:state 이벤트로 함께 갱신되지만, 방어적으로 직접 승계
          if (st.roomState.hostId === userId) {
            const next = [...st.roomState.players].sort((a, b) => a.slot - b.slot)[0];
            if (next) {
              st.roomState.hostId = next.id;
              st.roomState.players.forEach((p) => {
                p.isHost = p.id === next.id;
              });
            }
          }
        })
      );
      socket.on('match:update', (payload) =>
        set((st) => {
          st.matchLobby = payload;
        })
      );
      socket.on('match:found', ({ code }) =>
        set((st) => {
          st.matchFoundCode = code;
        })
      );
      socket.on('error', ({ message }) => {
        useToastStore.getState().show(message);
      });

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
        if (!on) {
          st.matchingSeconds = 0;
          st.matchLobby = null;
        }
      }),

    setMatchingSeconds: (n) =>
      set((st) => {
        st.matchingSeconds = n;
      }),

    setMatchLobby: (s) =>
      set((st) => {
        st.matchLobby = s;
      }),

    setMatchFoundCode: (code) =>
      set((st) => {
        st.matchFoundCode = code;
      }),
  }))
);
