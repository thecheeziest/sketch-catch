import { useCallback } from 'react';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { io, type Socket } from 'socket.io-client';
import type { ChatMessage, ClientEvents, ServerEvents, RoomState, Player } from '@sketch-catch/shared';
import { CLIENT_EVENT, SOCKET_NAMESPACE, UPDATE_REQUIRED_CODE } from '@sketch-catch/shared';
import { APP_CLIENT_INFO } from '../config/appInfo';
import { getChatTextColor } from '../config/cosmetics';
import { useAppUpdateStore } from './appUpdate';
import { useAuthStore } from './auth';
import { useToastStore } from './toast';
import { refreshAccessToken } from '../api/client';
import { Platform } from 'react-native';

// Android 에뮬레이터는 10.0.2.2로 호스트 머신에 접근 (api/client.ts와 동일 패턴)
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace('localhost', DEV_HOST);

type MatchLobby = {
  mode: 1 | 2;
  count: number;
  min: number;
  max: number;
  deadline: number | null; // epoch ms. null = 아직 최소 인원 미달(카운트다운 시작 전)
};

// 방 입장 자체가 거절된 에러 — 대기실 화면이 홈으로 되돌아가는 기준
const JOIN_REJECT_CODES = new Set(['ROOM_NOT_FOUND', 'ROOM_FULL', 'ALREADY_LEFT', 'GAME_IN_PROGRESS']);

type JoinError = { code: string; message: string };

// 백그라운드 복귀 확인 중 입장이 거절됐을 때 — 서버 에러 문구 대신 자리 만료로 안내한다
const RESYNC_EXPIRED_MESSAGE = '자리를 오래 비워 홈으로 돌아왔어요!';

function isMember(state: RoomState | null): boolean {
  const myId = useAuthStore.getState().user?.id;
  return state?.players.some(p => p.id === myId) ?? false;
}

// 방에서 한 번이라도 본 유저의 모습 — 나가서 players에서 빠져도 채팅·결과 화면에 캐릭터를 그리기 위해 남겨 둔다
export type KnownPlayer = { nickname: string; characterId: string; chatColorId: string | null };

function rememberPlayers(known: Record<string, KnownPlayer>, players: Player[]): void {
  for (const p of players) {
    const prev = known[p.id];
    const chatColorId = p.chatColorId ?? null;
    // 값이 같으면 건드리지 않아 room:state마다 구독 화면이 다시 그려지지 않게 한다
    if (prev && prev.nickname === p.nickname && prev.characterId === p.characterId && prev.chatColorId === chatColorId) {
      continue;
    }
    known[p.id] = { nickname: p.nickname, characterId: p.characterId, chatColorId };
  }
}

type RoomStore = {
  socket: Socket<ServerEvents, ClientEvents> | null;
  // 현재 소켓이 속한 방 코드 — 소켓은 방 1개에 귀속된다
  roomCode: string | null;
  joinError: JoinError | null;
  roomState: RoomState | null;
  knownPlayers: Record<string, KnownPlayer>;
  // 백그라운드 복귀 후 서버에 방 자리가 남아 있는지 확인하는 중 — 끝날 때까지 방 화면 조작을 막는다
  isResyncing: boolean;
  isMatchmaking: boolean;
  matchingSeconds: number;
  matchLobby: MatchLobby | null;
  matchFoundCode: string | null;
  connect: (code: string) => void;
  disconnect: (code: string) => void;
  resync: () => void;
  forceReconnect: () => void;
  endResync: () => void;
  setRoomState: (s: RoomState) => void;
  setMatchmaking: (on: boolean) => void;
  setMatchingSeconds: (n: number) => void;
  setMatchLobby: (s: MatchLobby | null) => void;
  setMatchFoundCode: (code: string | null) => void;
};

export const useRoomStore = create<RoomStore>()(
  immer((set, get) => ({
    socket: null,
    roomCode: null,
    joinError: null,
    roomState: null,
    knownPlayers: {},
    isResyncing: false,
    isMatchmaking: false,
    matchingSeconds: 0,
    matchLobby: null,
    matchFoundCode: null,

    // 방 코드마다 소켓을 새로 만든다. 다른 방의 소켓을 재사용하면 이전 방 이벤트(정답 등)가 새 게임에
    // 섞이고, 이전 방 화면 정리 시 공용 소켓이 끊겨 새 게임이 멈춘다 (A-3).
    connect: code => {
      const { socket: current, roomCode } = get();
      if (current && roomCode === code) return;
      current?.disconnect();

      const socket = io(`${BASE_URL}${SOCKET_NAMESPACE}`, {
        transports: ['websocket'], // Pitfall 1: RN에서 polling fallback 비활성화 필수
        // 재연결마다 스토어의 최신 accessToken을 읽는다 — 만료된 토큰 재사용 방지
        auth: cb => cb({ token: useAuthStore.getState().accessToken ?? '', ...APP_CLIENT_INFO }),
      });

      // accessToken 만료로 인증 실패 시 1회 갱신 후 재연결. connect 성공 시 초기화된다.
      let didRefreshAuth = false;
      let didWarnConnection = false;
      socket.on('connect', () => {
        didRefreshAuth = false;
        didWarnConnection = false;
        // 최초 연결·재연결 모두 방에 (재)입장 — 서버가 진행 중 라운드/스텝을 이 소켓에 다시 보내준다.
        // 이미 들어와 있던 방이면 resume — 끊긴 사이 명단에서 빠졌다면 새 참가자로 넣지 않고 거절받는다
        socket.emit(CLIENT_EVENT.ROOM_JOIN, { code, resume: isMember(get().roomState) });
      });
      socket.on('connect_error', err => {
        // 최소 빌드 미달 — 재연결해도 계속 거부되므로 연결을 멈추고 업데이트 화면으로 전환
        if (err.message === UPDATE_REQUIRED_CODE) {
          socket.disconnect();
          useAppUpdateStore.getState().requireUpdate();
          return;
        }
        const isAuthError = err.message === 'INVALID_TOKEN' || err.message === 'UNAUTHORIZED';
        // 토큰 만료는 아래에서 갱신 후 재연결하는 정상 흐름 — 에러로 기록하지 않는다 (개발 빌드 LogBox 에러 토스트 방지)
        if (!isAuthError) {
          // 네트워크 끊김 등은 socket.io가 자동 재연결한다 — 재시도마다 에러 토스트가 쌓이지 않도록 경고로 기록
          console.warn('[socket] connect_error', err.message);
          if (!didWarnConnection) {
            didWarnConnection = true;
            useToastStore.getState().show('앗, 연결이 끊겼어요! 다시 연결 중이에요', 'error');
          }
          return;
        }
        console.log('[socket] auth expired, refreshing token');
        if (didRefreshAuth) return;
        didRefreshAuth = true;
        void refreshAccessToken()
          .then(newToken => {
            if (newToken) socket.connect();
          })
          .catch(() => undefined); // 서버 장애로 재발급 실패 시 세션은 유지, 연결만 보류
      });
      // 이벤트명 리터럴 직접 사용 — SERVER_EVENT 상수를 통한 타입 추론이 socket.on 오버로드와 불일치 (D-04-04)
      socket.on('room:state', s => {
        if (s.code !== code) return;
        get().setRoomState(s);
        if (get().isResyncing) get().endResync();
      });
      socket.on('room:removed', payload => {
        if (payload.code !== code || get().roomCode !== code) return;
        set(st => {
          st.joinError = { code: 'ROOM_REMOVED', message: '시상식이 종료되어 방에서 나왔어요' };
          st.roomState = null;
        });
      });
      socket.on('room:player:join', ({ player }: { player: Player }) =>
        set(st => {
          if (st.roomState && !st.roomState.players.some(p => p.id === player.id)) {
            st.roomState.players.push(player);
          }
          rememberPlayers(st.knownPlayers, [player]);
        }),
      );
      socket.on('room:player:leave', ({ userId }: { userId: string }) =>
        set(st => {
          if (!st.roomState) return;
          st.roomState.players = st.roomState.players.filter(p => p.id !== userId);
          // hostId는 room:state 이벤트로 함께 갱신되지만, 방어적으로 직접 승계
          if (st.roomState.hostId === userId) {
            const next = [...st.roomState.players].sort((a, b) => a.slot - b.slot)[0];
            if (next) {
              st.roomState.hostId = next.id;
              st.roomState.players.forEach(p => {
                p.isHost = p.id === next.id;
              });
            }
          }
        }),
      );
      socket.on('error', ({ code: errorCode, message }) => {
        // 들어와 있던 방의 재접속이 거절된 것 — 끊긴 사이 방이 사라졌거나 명단에서 빠졌다 (코드 오류가 아님)
        const isRejoinRejected =
          (get().isResyncing || isMember(get().roomState)) && JOIN_REJECT_CODES.has(errorCode);
        if (isRejoinRejected) {
          useToastStore.getState().show(RESYNC_EXPIRED_MESSAGE, 'info');
        } else {
          useToastStore.getState().show(message, 'error');
        }
        if (!JOIN_REJECT_CODES.has(errorCode)) return;
        set(st => {
          st.joinError = { code: errorCode, message };
          st.isResyncing = false;
        });
      });

      set(st => {
        st.socket = socket as unknown as typeof st.socket;
        st.roomCode = code;
        st.joinError = null;
        st.roomState = null;
        st.isResyncing = false;
        // 다른 방에 들어갈 때만 비운다 — 방을 나간 뒤에도 시상식·리뷰 화면이 이전 방 유저를 그릴 수 있어야 한다
        st.knownPlayers = {};
      });
    },

    // 자기 방 소켓만 정리 — 다른 방으로 이동한 뒤 이전 방 화면의 정리 코드가 늦게 실행돼도 새 소켓을 끊지 않는다
    disconnect: code => {
      if (get().roomCode !== code) return;
      get().socket?.disconnect();
      set(st => {
        st.socket = null;
        st.roomCode = null;
        st.joinError = null;
        st.roomState = null;
        st.isResyncing = false;
      });
    },

    // 연결이 살아 있으면 재입장 요청으로 자리를 확인하고, 끊겨 있으면 다시 연결한다 (connect 핸들러가 재입장)
    // room:state를 받으면 끝나고, 입장이 거절되면 joinError로 각 화면이 홈으로 보낸다
    resync: () => {
      const { socket, roomCode, roomState } = get();
      if (!socket || !roomCode) return;
      set(st => {
        st.isResyncing = true;
      });
      if (socket.connected) {
        socket.emit(CLIENT_EVENT.ROOM_JOIN, { code: roomCode, resume: isMember(roomState) });
      } else {
        socket.connect();
      }
    },

    // iOS는 백그라운드 동안 끊긴 소켓을 ping 타임아웃 전까지 연결된 것으로 본다 — 응답이 없으면 직접 다시 연결한다
    forceReconnect: () => {
      const { socket } = get();
      if (!socket) return;
      socket.disconnect();
      socket.connect();
    },

    endResync: () =>
      set(st => {
        st.isResyncing = false;
      }),

    setRoomState: s =>
      set(st => {
        st.roomState = s;
        rememberPlayers(st.knownPlayers, [...s.players, ...(s.awardViewers ?? [])]);
      }),

    setMatchmaking: on =>
      set(st => {
        st.isMatchmaking = on;
        if (!on) {
          st.matchingSeconds = 0;
          st.matchLobby = null;
        }
      }),

    setMatchingSeconds: n =>
      set(st => {
        st.matchingSeconds = n;
      }),

    setMatchLobby: s =>
      set(st => {
        st.matchLobby = s;
      }),

    setMatchFoundCode: code =>
      set(st => {
        st.matchFoundCode = code;
      }),
  })),
);

// userId로 방에서 본 유저의 모습을 찾는 함수 — 지금 players에 없는(나간) 유저도 찾는다
export function useKnownPlayer(): (userId: string | null | undefined) => KnownPlayer | undefined {
  const knownPlayers = useRoomStore(s => s.knownPlayers);
  return useCallback(userId => (userId ? knownPlayers[userId] : undefined), [knownPlayers]);
}

// 채팅 보낸 사람의 캐릭터·글자색 — 메시지에 담긴 보낸 시점 값을 먼저 쓰고, 없으면(이전 서버) 방에서 본 모습으로 채운다
export function useChatSenderLook(): (message: ChatMessage) => { characterId: string; textColor: string | null } {
  const knownPlayer = useKnownPlayer();
  return useCallback(
    message => {
      const known = knownPlayer(message.userId);
      const chatColorId = message.chatColorId !== undefined ? message.chatColorId : known?.chatColorId;
      return { characterId: message.characterId ?? known?.characterId ?? '', textColor: getChatTextColor(chatColorId) };
    },
    [knownPlayer],
  );
}
