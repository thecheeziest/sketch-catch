import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Mode2Step, Mode2ReviewLiveUpdate, Mode2ReviewState, RoomState, Stroke } from '@sketch-catch/shared';
import { CLIENT_EVENT } from '@sketch-catch/shared';
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
  // 실시간 공개식에서 지금 시트가 시작된 기기 시각 — 시트 안의 발표는 이 시각부터 기기가 직접 재생한다
  reviewSheetStartAt: number | null;
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
    reviewSheetStartAt: null,

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
          st.reviewSheetStartAt = live ? Date.now() - live.elapsedMs : null;
        });
      };

      // 다음 시트로 넘어갈 때 오는 위치 신호 — 시트(그림)를 아직 못 받았으면 재입장으로 전체를 다시 받는다
      const handleReviewLive = (payload: Mode2ReviewLiveUpdate): void => {
        if (!isCurrentGame(payload.gameId)) return;
        if (!get().review) {
          const code = useRoomStore.getState().roomCode;
          if (code) socket.emit(CLIENT_EVENT.ROOM_JOIN, { code, resume: true });
          return;
        }
        const live = payload.live;
        set(st => {
          if (!st.review) return;
          st.review.live = live;
          st.reviewSheetStartAt = live ? Date.now() - live.elapsedMs : null;
        });
      };

      // 이벤트명 리터럴 직접 사용 — D-04-04
      socket.on('room:state', handleRoomState);
      socket.on('mode2:step', handleStep);
      socket.on('mode2:review', handleReview);
      socket.on('mode2:review:live', handleReviewLive);

      return () => {
        socket.off('room:state', handleRoomState);
        socket.off('mode2:step', handleStep);
        socket.off('mode2:review', handleReview);
        socket.off('mode2:review:live', handleReviewLive);
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
        st.reviewSheetStartAt = null;
      }),
  })),
);
