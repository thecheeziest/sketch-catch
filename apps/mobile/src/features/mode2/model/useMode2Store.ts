import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Mode2Step, Mode2ReviewState, Stroke } from '@sketch-catch/shared';
import { useRoomStore } from '@/shared/model/room';
import { useAuthStore } from '@/shared/model/auth';

type Mode2Store = {
  step: Mode2Step | null;
  myStrokes: Stroke[];
  review: Mode2ReviewState | null;
  gifs: Record<string, string>;
  // actions
  registerMode2Listeners: () => void;
  setMyStrokes: (strokes: Stroke[]) => void;
  reset: () => void;
};

export const useMode2Store = create<Mode2Store>()(
  immer((set) => ({
    step: null,
    myStrokes: [],
    review: null,
    gifs: {},

    registerMode2Listeners: () => {
      const socket = useRoomStore.getState().socket;
      if (!socket) return;

      // 이벤트명 리터럴 직접 사용 — D-04-04
      // 서버는 시트별로 mode2:step을 N회 broadcast(emitSteps) — 매 스텝마다 내가 담당자인
      // 시트 1개만 존재(D-12, 시트 수=인원 수)하므로 assigneeId로 필터링해 마지막 이벤트로
      // 덮어써지는 레이스를 방지한다.
      socket.on('mode2:step', (payload: Mode2Step) => {
        const myId = useAuthStore.getState().user?.id;
        if (payload.assigneeId !== myId) return;
        set((st) => {
          st.step = payload;
        });
      });

      socket.on('mode2:review', (payload: Mode2ReviewState) => {
        set((st) => {
          st.review = payload;
        });
      });

      socket.on('cookie:ready', ({ sheetId, gifUrl }: { sheetId: string; gifUrl: string }) => {
        set((st) => {
          st.gifs[sheetId] = gifUrl;
        });
      });
    },

    setMyStrokes: (strokes) =>
      set((st) => {
        st.myStrokes = strokes;
      }),

    reset: () =>
      set((st) => {
        st.step = null;
        st.myStrokes = [];
        st.review = null;
        st.gifs = {};
      }),
  }))
);
