import type { PresenceClientEvents, PresenceServerEvents } from '@sketch-catch/shared';
import { PRESENCE_NAMESPACE } from '@sketch-catch/shared';
import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';
import { Platform } from 'react-native';
import { queryClient } from '../api/queryClient';
import { refreshAccessToken } from '../api/client';
import { useAuthStore } from './auth';
import type { Friend } from './friends';
import { useRoomStore } from './room';

const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace('localhost', DEV_HOST);

type PresenceStore = {
  socket: Socket<PresenceServerEvents, PresenceClientEvents> | null;
  pendingFriendIds: string[];
  connect: () => void;
  disconnect: () => void;
  subscribe: (friendIds: string[]) => void;
};

export const usePresenceStore = create<PresenceStore>()((set, get) => ({
  socket: null,
  pendingFriendIds: [],

  connect: () => {
    if (get().socket?.connected) return;
    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    const socket: Socket<PresenceServerEvents, PresenceClientEvents> = io(
      `${BASE_URL}${PRESENCE_NAMESPACE}`,
      {
        transports: ['websocket'],
        // 재연결마다 스토어의 최신 accessToken을 읽는다 — 만료된 토큰 재사용 방지
        auth: (cb) => cb({ token: useAuthStore.getState().accessToken ?? '' }),
      },
    );

    // accessToken 만료로 인증 실패 시 1회 갱신 후 재연결.
    // connect 성공 시 초기화되어 다음 만료에도 다시 동작한다.
    let didRefreshAuth = false;

    socket.on('connect', () => {
      didRefreshAuth = false;
      const { pendingFriendIds } = get();
      if (pendingFriendIds.length > 0) {
        socket.emit('presence:subscribe', { friendIds: pendingFriendIds });
      }
    });

    socket.on('presence:update', ({ userId, status, room }) => {
      console.log('[presence] received update:', userId, '→', status);
      // room은 서버가 broadcast 시점에 직접 계산해 함께 보낸다 — REST refetch에 의존하지 않으므로
      // 구독자마다 반영 속도가 갈리는 레이스(일부 친구에게만 "같이하기"가 안 뜨는 문제)가 없다.
      queryClient.setQueryData<Friend[]>(['friends'], (old) =>
        old?.map((f) => (f.userId === userId ? { ...f, presenceStatus: status, room } : f)) ?? old,
      );
    });

    // 매칭 로비 — 홈(매칭 대기) 화면에는 방 소켓이 없으므로 항상 연결된 presence 소켓으로 받는다
    socket.on('match:update', (payload) => useRoomStore.getState().setMatchLobby(payload));
    socket.on('match:found', ({ code }) => useRoomStore.getState().setMatchFoundCode(code));

    socket.on('connect_error', (err) => {
      const isAuthError = err.message === 'INVALID_TOKEN' || err.message === 'UNAUTHORIZED';
      // 토큰 만료는 아래에서 갱신 후 재연결하는 정상 흐름 — 에러로 기록하지 않는다 (개발 빌드 LogBox 에러 토스트 방지)
      if (!isAuthError) {
        // 네트워크 끊김 등은 socket.io가 자동 재연결한다 — 재시도마다 에러 토스트가 쌓이지 않도록 경고로 기록
        console.warn('[presence] connect_error', err.message);
        return;
      }
      console.log('[presence] auth expired, refreshing token');
      if (didRefreshAuth) return;
      didRefreshAuth = true;
      void refreshAccessToken().then((newToken) => {
        if (newToken) socket.connect();
      });
    });

    set({ socket });
  },

  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null, pendingFriendIds: [] });
  },

  subscribe: (friendIds: string[]) => {
    set({ pendingFriendIds: friendIds });
    const { socket } = get();
    // 소켓이 아직 연결 중이면 connect 이벤트에서 pendingFriendIds를 꺼내 전송
    if (socket?.connected) {
      socket.emit('presence:subscribe', { friendIds });
    }
  },
}));
