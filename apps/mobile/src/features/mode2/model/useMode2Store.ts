import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Mode2Step, Mode2ReviewState, RoomState, Stroke } from '@sketch-catch/shared';
import { useRoomStore } from '@/shared/model/room';
import { useAuthStore } from '@/shared/model/auth';

// 서버가 보낸 남은 시간을 수신 시각 기준 기기 시계로 바꾼 값 — 기기 시계 차이에 흔들리지 않는다
export type Mode2StepTiming = {
  deadline: number;
  cueUntil: number;
};

type Mode2Store = {
  // 지금 진행 중인 게임 1판의 식별자 (room:state 기준). 다른 gameId의 이벤트는 버린다
  gameId: string | null;
  step: Mode2Step | null;
  stepTiming: Mode2StepTiming | null;
  myStrokes: Stroke[];
  review: Mode2ReviewState | null;
  // 실시간 공개식에서 현재 발표가 시작되는(된) 기기 시각
  reviewEntryStartAt: number | null;
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
    stepTiming: null,
    myStrokes: [],
    review: null,
    reviewEntryStartAt: null,
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
        set(st => {
          st.gameId = nextGameId;
        });
      };

      // 서버는 담당자 본인에게만 mode2:step을 보낸다. 재입장 재전송과 겹쳐도 내 담당 시트만 받도록 한 번 더 거른다
      const handleStep = (payload: Mode2Step): void => {
        if (!isCurrentGame(payload.gameId)) return;
        const myId = useAuthStore.getState().user?.id;
        if (payload.assigneeId !== myId) return;
        const now = Date.now();
        set(st => {
          st.step = payload;
          st.stepTiming = { deadline: now + payload.remainingMs, cueUntil: now + (payload.cueMs ?? 0) };
        });
      };

      const handleReview = (payload: Mode2ReviewState): void => {
        if (!isCurrentGame(payload.gameId)) return;
        const live = payload.live;
        set(st => {
          st.review = payload;
          st.reviewEntryStartAt = live ? Date.now() + live.leadMs - live.elapsedMs : null;
        });
      };

      const handleCookieReady = ({ sheetId, gifUrl }: { sheetId: string; gifUrl: string }): void => {
        set(st => {
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

    setMyStrokes: strokes =>
      set(st => {
        st.myStrokes = strokes;
      }),

    reset: () =>
      set(st => {
        st.gameId = null;
        st.step = null;
        st.stepTiming = null;
        st.myStrokes = [];
        st.review = null;
        st.reviewEntryStartAt = null;
        st.gifs = {};
      }),
  })),
);
