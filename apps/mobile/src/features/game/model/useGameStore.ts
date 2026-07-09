import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { StrokeEvent, Point, RoundStart, RoundEnd, GameResult, ChatMessage } from '@sketch-catch/shared';
import { useRoomStore } from '@/shared/model/room';
import { useAuthStore } from '@/shared/model/auth';
import { colors } from '@/shared/config';

const MAX_CHAT_MESSAGES = 50;

type RemoteStroke = {
  strokeId: string;
  authorId: string;
  color: string;
  width: number;
  points: Point[];
  ended: boolean;
};

type GameStore = {
  round: { roundIndex: number; drawerId: string; durationSec: number } | null;
  promptForDrawer: string | null;
  promptHint: string | null;
  currentPrompt: string | null;
  needsCustomPrompt: boolean;
  remoteStrokes: RemoteStroke[];
  chatMessages: ChatMessage[];
  correct: { userId: string; messageId: string } | null;
  result: GameResult | null;
  roundResult: RoundEnd | null;
  // 도구 상태 (DRAW-02)
  color: string;
  width: number;
  eraser: boolean;
  // actions
  registerGameListeners: () => void;
  applyRemoteStroke: (e: StrokeEvent) => void;
  setColor: (c: string) => void;
  setWidth: (w: number) => void;
  setEraser: (on: boolean) => void;
  clearRemote: () => void;
  reset: () => void;
};

export const useGameStore = create<GameStore>()(
  immer((set, get) => ({
    round: null,
    promptForDrawer: null,
    promptHint: null,
    currentPrompt: null,
    needsCustomPrompt: false,
    remoteStrokes: [],
    chatMessages: [],
    correct: null,
    result: null,
    roundResult: null,
    color: colors.DARK_500,
    width: 8,
    eraser: false,

    applyRemoteStroke: (e: StrokeEvent) => {
      set((st) => {
        if (e.strokeId === '__clear__') {
          st.remoteStrokes = [];
          return;
        }
        if (e.strokeId === '__undo__') {
          st.remoteStrokes.pop();
          return;
        }
        const existing = st.remoteStrokes.find((s) => s.strokeId === e.strokeId);
        if (existing) {
          if (e.points) {
            existing.points = existing.points.concat(e.points);
          }
          if (e.ended !== undefined) {
            existing.ended = e.ended;
          }
        } else {
          st.remoteStrokes.push({
            strokeId: e.strokeId,
            authorId: e.authorId,
            color: e.color ?? colors.DARK_500,
            width: e.width ?? 8,
            points: e.points ?? [],
            ended: e.ended ?? false,
          });
        }
      });
    },

    registerGameListeners: () => {
      const socket = useRoomStore.getState().socket;
      if (!socket) return;
      const myId = useAuthStore.getState().user?.id;

      // 이벤트명 리터럴 직접 사용 — D-04-04
      socket.on('game:round:start', (payload: RoundStart) => {
        set((st) => {
          st.round = {
            roundIndex: payload.roundIndex,
            drawerId: payload.drawerId,
            durationSec: payload.durationSec,
          };
          st.currentPrompt = payload.promptForDrawer ?? null;
          if (payload.drawerId === myId) {
            st.promptForDrawer = payload.promptForDrawer ?? null;
            // 커스텀 모드: 제시어 입력 전 첫 game:round:start 이벤트
            st.needsCustomPrompt = payload.needsCustomPrompt === true && !payload.promptForDrawer;
          } else {
            st.promptForDrawer = null;
            st.needsCustomPrompt = false;
          }
          st.promptHint = payload.promptForDrawer
            ? payload.promptForDrawer.split('').map((ch) => (ch === ' ' ? ' ' : 'ㅇ')).join('')
            : null;
          // 커스텀 모드: 서버가 제시어를 받은 뒤 다시 game:round:start를 보낼 때 캔버스 유지
          if (!payload.needsCustomPrompt) {
            st.remoteStrokes = [];
          }
        });
      });

      socket.on('game:round:end', (payload: RoundEnd) => {
        set((st) => {
          st.roundResult = payload;
        });
      });

      socket.on('game:end', (payload: GameResult) => {
        set((st) => {
          st.result = payload;
        });
      });

      socket.on('stroke:remote', (e: StrokeEvent) => {
        get().applyRemoteStroke(e);
      });

      socket.on('chat:message', (msg: ChatMessage) => {
        set((st) => {
          st.chatMessages.push(msg);
          if (st.chatMessages.length > MAX_CHAT_MESSAGES) {
            st.chatMessages.splice(0, st.chatMessages.length - MAX_CHAT_MESSAGES);
          }
        });
      });

      socket.on('chat:correct', (payload: { userId: string; messageId: string }) => {
        set((st) => {
          st.correct = payload;
        });
      });
    },

    setColor: (c) =>
      set((st) => {
        st.color = c;
        st.eraser = false;
      }),

    setWidth: (w) =>
      set((st) => {
        st.width = w;
      }),

    setEraser: (on) =>
      set((st) => {
        st.eraser = on;
      }),

    clearRemote: () =>
      set((st) => {
        st.remoteStrokes = [];
      }),

    reset: () =>
      set((st) => {
        st.round = null;
        st.promptForDrawer = null;
        st.promptHint = null;
        st.currentPrompt = null;
        st.needsCustomPrompt = false;
        st.remoteStrokes = [];
        st.chatMessages = [];
        st.correct = null;
        st.result = null;
        st.roundResult = null;
        st.color = colors.DARK_500;
        st.width = 8;
        st.eraser = false;
      }),
  }))
);
