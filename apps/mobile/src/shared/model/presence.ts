import type { PresenceClientEvents, PresenceServerEvents } from '@sketch-catch/shared';
import { PRESENCE_NAMESPACE } from '@sketch-catch/shared';
import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';
import { Platform } from 'react-native';
import { queryClient } from '../api';
import { useAuthStore } from './auth';
import type { Friend } from './friends';

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
      { transports: ['websocket'], auth: { token } },
    );

    socket.on('connect', () => {
      const { pendingFriendIds } = get();
      if (pendingFriendIds.length > 0) {
        socket.emit('presence:subscribe', { friendIds: pendingFriendIds });
      }
    });

    socket.on('presence:update', ({ userId, status }) => {
      console.log('[presence] received update:', userId, '→', status);
      queryClient.setQueryData<Friend[]>(['friends'], (old) =>
        old?.map((f) => (f.userId === userId ? { ...f, presenceStatus: status, room: undefined } : f)) ?? old,
      );
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
    });

    socket.on('connect_error', (err) =>
      console.error('[presence] connect_error', err.message),
    );

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
