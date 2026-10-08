import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  StrokeEvent,
  PaintSpan,
  Point,
  RoundStart,
  RoundEnd,
  GameResult,
  ChatMessage,
  RoomState,
} from '@sketch-catch/shared';
import { useRoomStore } from '@/shared/model/room';
import { useAuthStore } from '@/shared/model/auth';
import { colors } from '@/shared/config';

const MAX_CHAT_MESSAGES = 50;

type RemoteStroke = {
  strokeId: string;
  authorId: string;
  color: string;
  width: number;
  paintSpans?: PaintSpan[];
  points: Point[];
  ended: boolean;
};

type GameStore = {
  // 지금 진행 중인 게임 1판의 식별자 (room:state 기준). 다른 gameId의 이벤트는 지난 게임 것으로 보고 버린다
  gameId: string | null;
  round: { roundIndex: number; drawerId: string; durationSec: number } | null;
  promptForDrawer: string | null;
  promptHint: string | null;
  needsCustomPrompt: boolean;
  waitingForPrompt: boolean;
  promptInputEndsAt: number | null;
  // 이번 라운드가 출제자가 직접 제시어를 입력하는 커스텀 라운드인지 여부
  // (프리셋 제시어 라운드에선 '정답 인정' 수동 버튼을 노출하지 않는다)
  isCustomRound: boolean;
  remoteStrokes: RemoteStroke[];
  chatMessages: ChatMessage[];
  correct: { userId: string; messageId: string } | null;
  wrongAnswer: { messageId: string } | null;
  result: GameResult | null;
  roundResult: RoundEnd | null;
  // 도구 상태 (DRAW-02)
  color: string;
  width: number;
  eraser: boolean;
  paint: boolean;
  // 출제자 본인은 stroke:remote를 받지 않으므로(서버가 sender 제외 broadcast), 지우기/되돌리기
  // 신호를 스토어 nonce로 전달해 DrawingCanvas의 로컬 stroke도 함께 정리한다.
  drawerClearNonce: number;
  drawerUndoNonce: number;
  // actions
  // 방 소켓에 게임 이벤트 리스너를 1회 등록하고 해제 함수를 돌려준다 (room/[code]/_layout에서 호출)
  registerGameListeners: () => () => void;
  applyRemoteStroke: (e: StrokeEvent) => void;
  setColor: (c: string) => void;
  setWidth: (w: number) => void;
  setEraser: (on: boolean) => void;
  setPaint: (on: boolean) => void;
  clearRemote: () => void;
  requestDrawerClear: () => void;
  requestDrawerUndo: () => void;
  reset: () => void;
};

export const useGameStore = create<GameStore>()(
  immer((set, get) => ({
    gameId: null,
    round: null,
    promptForDrawer: null,
    promptHint: null,
    needsCustomPrompt: false,
    waitingForPrompt: false,
    promptInputEndsAt: null,
    isCustomRound: false,
    remoteStrokes: [],
    chatMessages: [],
    correct: null,
    wrongAnswer: null,
    result: null,
    roundResult: null,
    // 드로잉 팔레트(2c) 기본 선택색 = 팔레트 잉크. 팔레트에 없는 값이면 ColorPicker가 미선택으로 보인다.
    color: '#14101C',
    width: 8,
    eraser: false,
    paint: false,
    drawerClearNonce: 0,
    drawerUndoNonce: 0,

    applyRemoteStroke: (e: StrokeEvent) => {
      set(st => {
        if (e.strokeId === '__clear__') {
          st.remoteStrokes = [];
          return;
        }
        if (e.strokeId === '__undo__') {
          st.remoteStrokes.pop();
          return;
        }
        const existing = st.remoteStrokes.find(s => s.strokeId === e.strokeId);
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
            paintSpans: e.paintSpans,
            ended: e.ended ?? false,
          });
        }
      });
    },

    registerGameListeners: () => {
      const socket = useRoomStore.getState().socket;
      if (!socket) return () => undefined;
      const myId = useAuthStore.getState().user?.id;
      const isCurrentGame = (gameId: string): boolean => gameId === get().gameId;

      // 새 게임이 시작되거나(대기실 → 게임) 대기실로 돌아오면 gameId가 바뀐다 — 이전 판의 데이터를 비운다
      const handleRoomState = (state: RoomState): void => {
        const nextGameId = state.gameId ?? null;
        if (nextGameId === get().gameId) return;
        get().reset();
        set(st => {
          st.gameId = nextGameId;
        });
      };

      const handleRoundStart = (payload: RoundStart): void => {
        if (!isCurrentGame(payload.gameId)) return;
        set(st => {
          // 커스텀 라운드는 제시어 입력 전/후 두 번의 round:start를 같은 roundIndex로 보낸다.
          // 새 라운드 진입 시점에만 커스텀 여부를 확정하고, 후속 재전송에선 유지한다.
          const isNewRound = st.round?.roundIndex !== payload.roundIndex;
          st.round = {
            roundIndex: payload.roundIndex,
            drawerId: payload.drawerId,
            durationSec: payload.durationSec,
          };
          if (isNewRound) {
            st.isCustomRound = payload.isCustomRound ?? payload.needsCustomPrompt === true;
            // 새 라운드 진입 — 직전 라운드의 정답/오답/결과 오버레이 데이터를 정리한다
            // (결과 오버레이·정답 공개·입력창 상태는 이 값들을 기준으로 삼는다).
            st.correct = null;
            st.wrongAnswer = null;
            st.roundResult = null;
          }
          st.waitingForPrompt = payload.needsCustomPrompt === true;
          st.promptInputEndsAt = payload.promptInputEndsAt ?? null;
          if (payload.drawerId === myId) {
            st.promptForDrawer = payload.promptForDrawer ?? null;
            // 커스텀 모드: 제시어 입력 전 첫 game:round:start 이벤트
            st.needsCustomPrompt = payload.needsCustomPrompt === true && !payload.promptForDrawer;
          } else {
            st.promptForDrawer = null;
            st.needsCustomPrompt = false;
          }
          st.promptHint = payload.promptHint ?? null;
          // 커스텀 모드: 서버가 제시어를 받은 뒤 다시 game:round:start를 보낼 때 캔버스 유지
          if (isNewRound) {
            st.remoteStrokes = [];
          }
        });
      };

      const handleRoundEnd = (payload: RoundEnd): void => {
        if (!isCurrentGame(payload.gameId)) return;
        set(st => {
          st.roundResult = payload;
        });
      };

      const handleGameEnd = (payload: GameResult): void => {
        if (!isCurrentGame(payload.gameId)) return;
        set(st => {
          st.result = payload;
        });
      };

      const handleStrokeRemote = (e: StrokeEvent): void => {
        get().applyRemoteStroke(e);
      };

      const handleChatMessage = (msg: ChatMessage): void => {
        set(st => {
          st.chatMessages.push(msg);
          if (st.chatMessages.length > MAX_CHAT_MESSAGES) {
            st.chatMessages.splice(0, st.chatMessages.length - MAX_CHAT_MESSAGES);
          }
        });
      };

      const handleChatCorrect = (payload: { gameId: string; userId: string; messageId: string }): void => {
        if (!isCurrentGame(payload.gameId)) return;
        set(st => {
          st.correct = { userId: payload.userId, messageId: payload.messageId };
        });
      };

      const handleAnswerWrong = (payload: { messageId: string; roundIndex: number }): void => {
        set(st => {
          // 네트워크 지연으로 응답이 라운드 종료 후 도착하면 다음 라운드 시작 화면에서
          // 엉뚱하게 "오답입니다" 피드백이 뜬다 — 이미 지난 라운드의 응답이면 무시한다.
          if (st.round !== null && payload.roundIndex !== st.round.roundIndex) return;
          st.wrongAnswer = payload;
        });
      };

      // 이벤트명 리터럴 직접 사용 — D-04-04
      socket.on('room:state', handleRoomState);
      socket.on('game:round:start', handleRoundStart);
      socket.on('game:round:end', handleRoundEnd);
      socket.on('game:end', handleGameEnd);
      socket.on('stroke:remote', handleStrokeRemote);
      socket.on('chat:message', handleChatMessage);
      socket.on('chat:correct', handleChatCorrect);
      socket.on('answer:wrong', handleAnswerWrong);

      return () => {
        socket.off('room:state', handleRoomState);
        socket.off('game:round:start', handleRoundStart);
        socket.off('game:round:end', handleRoundEnd);
        socket.off('game:end', handleGameEnd);
        socket.off('stroke:remote', handleStrokeRemote);
        socket.off('chat:message', handleChatMessage);
        socket.off('chat:correct', handleChatCorrect);
        socket.off('answer:wrong', handleAnswerWrong);
      };
    },

    setColor: c =>
      set(st => {
        st.color = c;
        st.eraser = false;
      }),

    setWidth: w =>
      set(st => {
        st.width = w;
      }),

    setEraser: on =>
      set(st => {
        st.eraser = on;
        st.paint = false;
      }),

    setPaint: on =>
      set(st => {
        st.paint = on;
        st.eraser = false;
      }),

    clearRemote: () =>
      set(st => {
        st.remoteStrokes = [];
      }),

    requestDrawerClear: () =>
      set(st => {
        st.drawerClearNonce += 1;
      }),

    requestDrawerUndo: () =>
      set(st => {
        st.drawerUndoNonce += 1;
      }),

    reset: () =>
      set(st => {
        st.gameId = null;
        st.round = null;
        st.promptForDrawer = null;
        st.promptHint = null;
        st.needsCustomPrompt = false;
        st.waitingForPrompt = false;
        st.promptInputEndsAt = null;
        st.isCustomRound = false;
        st.remoteStrokes = [];
        st.chatMessages = [];
        st.correct = null;
        st.wrongAnswer = null;
        st.result = null;
        st.roundResult = null;
        st.color = '#14101C';
        st.width = 8;
        st.eraser = false;
        st.paint = false;
        st.drawerClearNonce = 0;
        st.drawerUndoNonce = 0;
      }),
  })),
);
