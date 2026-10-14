import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ChatMessage, RoomState } from '@sketch-catch/shared';
import { useRoomStore } from '@/shared/model/room';

const MAX_MESSAGES = 100;

type RoomChatStore = {
  // 대기실 채팅 — 게임이 시작되거나 대기실이 새로 열리면(gameId 변경) 비운다
  lobbyMessages: ChatMessage[];
  // 시상식에 남은 유저끼리의 채팅 — 새 게임이 시작되면 비운다
  awardMessages: ChatMessage[];
  // 방 소켓에 대기실·시상식 채팅 리스너를 1회 등록하고 해제 함수를 돌려준다 (room/[code]/_layout에서 호출)
  registerRoomChatListeners: () => () => void;
};

function pushCapped(list: ChatMessage[], msg: ChatMessage): void {
  list.push(msg);
  if (list.length > MAX_MESSAGES) list.splice(0, list.length - MAX_MESSAGES);
}

export const useRoomChatStore = create<RoomChatStore>()(
  immer(set => ({
    lobbyMessages: [],
    awardMessages: [],

    registerRoomChatListeners: () => {
      const socket = useRoomStore.getState().socket;
      if (!socket) return () => undefined;
      let gameId: string | null = null;

      const handleRoomState = (state: RoomState): void => {
        const nextGameId = state.gameId ?? null;
        if (nextGameId === gameId) return;
        gameId = nextGameId;
        set(st => {
          st.lobbyMessages = [];
          if (nextGameId !== null) st.awardMessages = [];
        });
      };

      const handleChatMessage = (msg: ChatMessage): void => {
        if (msg.channel === undefined) return;
        set(st => {
          pushCapped(msg.channel === 'LOBBY' ? st.lobbyMessages : st.awardMessages, msg);
        });
      };

      socket.on('room:state', handleRoomState);
      socket.on('chat:message', handleChatMessage);
      return () => {
        socket.off('room:state', handleRoomState);
        socket.off('chat:message', handleChatMessage);
        set(st => {
          st.lobbyMessages = [];
          st.awardMessages = [];
        });
      };
    },
  })),
);
