import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Mode2Step, Mode2ReviewState, Stroke } from '@sketch-catch/shared';
import { useRoomStore } from '@/shared/model/room';

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
      socket.on('mode2:step', (payload: Mode2Step) => {
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
