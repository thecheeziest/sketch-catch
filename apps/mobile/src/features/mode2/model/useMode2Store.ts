import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Mode2Step, Mode2ReviewState, RoomState, Stroke } from '@sketch-catch/shared';
import { useRoomStore } from '@/shared/model/room';
import { useAuthStore } from '@/shared/model/auth';

type Mode2Store = {
  // 지금 진행 중인 게임 1판의 식별자 (room:state 기준). 다른 gameId의 이벤트는 버린다
  gameId: string | null;
  step: Mode2Step | null;
  myStrokes: Stroke[];
  review: Mode2ReviewState | null;
  gifs: Record<string, string>;
  // actions
  // 방 소켓에 모드2 이벤트 리스너를 1회 등록하고 해제 함수를 돌려준다 (room/[code]/_layout에서 호출)
  registerMode2Listeners: () => () => void;
  setMyStrokes: (strokes: Stroke[]) => void;
  reset: () => void;
};

export const useMode2Store = create<Mode2Store>()(
  immer((set, get) => ({
    gameId: null,
    step: null,
    myStrokes: [],
    review: null,
    gifs: {},

    registerMode2Listeners: () => {
      const socket = useRoomStore.getState().socket;
      if (!socket) return () => undefined;
      const isCurrentGame = (gameId: string): boolean => gameId === get().gameId;

      // 새 게임 시작·대기실 복귀로 gameId가 바뀌면 이전 판의 시트·리뷰·GIF를 비운다
      const handleRoomState = (state: RoomState): void => {
        const nextGameId = state.gameId ?? null;
        if (nextGameId === get().gameId) return;
        get().reset();
        set((st) => {
          st.gameId = nextGameId;
        });
      };

      // 서버는 시트별로 mode2:step을 N회 broadcast(emitSteps) — 매 스텝마다 내가 담당자인
      // 시트 1개만 존재(D-12, 시트 수=인원 수)하므로 assigneeId로 필터링해 마지막 이벤트로
      // 덮어써지는 레이스를 방지한다.
      const handleStep = (payload: Mode2Step): void => {
        if (!isCurrentGame(payload.gameId)) return;
        const myId = useAuthStore.getState().user?.id;
        if (payload.assigneeId !== myId) return;
        set((st) => {
          st.step = payload;
        });
      };

      const handleReview = (payload: Mode2ReviewState): void => {
        if (!isCurrentGame(payload.gameId)) return;
        set((st) => {
          st.review = payload;
        });
      };

      const handleCookieReady = ({ sheetId, gifUrl }: { sheetId: string; gifUrl: string }): void => {
        set((st) => {
          st.gifs[sheetId] = gifUrl;
        });
      };

      // 이벤트명 리터럴 직접 사용 — D-04-04
      socket.on('room:state', handleRoomState);
      socket.on('mode2:step', handleStep);
      socket.on('mode2:review', handleReview);
      socket.on('cookie:ready', handleCookieReady);

      return () => {
        socket.off('room:state', handleRoomState);
        socket.off('mode2:step', handleStep);
        socket.off('mode2:review', handleReview);
        socket.off('cookie:ready', handleCookieReady);
      };
    },

    setMyStrokes: (strokes) =>
      set((st) => {
        st.myStrokes = strokes;
      }),

    reset: () =>
      set((st) => {
        st.gameId = null;
        st.step = null;
        st.myStrokes = [];
        st.review = null;
        st.gifs = {};
      }),
  }))
);
