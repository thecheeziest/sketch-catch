import type { Point, Stroke } from '../types/stroke.js';
import type { RoomState, Player } from '../types/room.js';
import type {
  RoundStart,
  RoundEnd,
  GameResult,
  ChatMessage,
  Mode2Step,
  Mode2ReviewState,
} from '../types/game.js';
import type { StrokeEvent } from '../types/stroke.js';

// 클라이언트 → 서버 (Socket.io EventsMap: 각 이벤트를 함수 시그니처로 정의)
export type ClientEvents = {
  auth: (payload: { token: string }) => void;
  'room:join': (payload: { code: string }) => void;
  'room:leave': () => void;
  'room:ready': (payload: { ready: boolean }) => void;
  'room:start': () => void;
  // 시상식에서 [한번 더!] — 같은 방 대기실로 복귀
  'room:rematch': () => void;
  'stroke:start': (payload: { strokeId: string; color: string; width: number }) => void;
  'stroke:append': (payload: { strokeId: string; points: Point[] }) => void;
  'stroke:end': (payload: { strokeId: string }) => void;
  'stroke:undo': () => void;
  'stroke:clear': () => void;
  'chat:send': (payload: { text: string }) => void;
  'answer:accept': (payload: { messageId: string }) => void;
  'game:custom:prompt': (payload: { text: string }) => void;
  'mode2:prompt': (payload: { sheetId: string; text: string }) => void;
  'mode2:draw:done': (payload: { sheetId: string; strokes: Stroke[] }) => void; // GIF용 stroke 포함
  'mode2:answer': (payload: { sheetId: string; text: string }) => void;
  'mode2:judge:final': (payload: { sheetId: string; ok: boolean }) => void; // D-02 최종 판정 1회
  'mode2:vote:best': (payload: { sheetId: string }) => void;
};

// 서버 → 클라이언트 (Socket.io EventsMap: 각 이벤트를 함수 시그니처로 정의)
export type ServerEvents = {
  'room:state': (state: RoomState) => void;
  'room:player:join': (payload: { player: Player }) => void;
  'room:player:leave': (payload: { userId: string }) => void;
  'game:round:start': (payload: RoundStart) => void;
  'game:round:end': (payload: RoundEnd) => void;
  'game:end': (payload: GameResult) => void;
  'stroke:remote': (payload: StrokeEvent) => void;
  'chat:message': (payload: ChatMessage) => void;
  'chat:correct': (payload: { gameId: string; userId: string; messageId: string }) => void;
  'answer:wrong': (payload: { messageId: string; roundIndex: number }) => void; // 오답 제출자 본인에게만 전달
  'mode2:step': (payload: Mode2Step) => void;
  'mode2:review': (payload: Mode2ReviewState) => void;
  'cookie:ready': (payload: { sheetId: string; gifUrl: string }) => void;
  error: (payload: { code: string; message: string }) => void;
};

// 매칭 로비 상태 — 대기 인원/카운트다운 마감시각을 로비 전원에게 push
export type MatchLobbyUpdate = {
  mode: 1 | 2;
  count: number;
  min: number;
  max: number;
  deadline: number | null; // epoch ms. null = 아직 최소 인원 미달(카운트다운 시작 전)
};

// 문자열 상수 — emit/on에서 매직 스트링 방지
export const CLIENT_EVENT = {
  AUTH: 'auth',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_READY: 'room:ready',
  ROOM_START: 'room:start',
  ROOM_REMATCH: 'room:rematch',
  STROKE_START: 'stroke:start',
  STROKE_APPEND: 'stroke:append',
  STROKE_END: 'stroke:end',
  STROKE_UNDO: 'stroke:undo',
  STROKE_CLEAR: 'stroke:clear',
  CHAT_SEND: 'chat:send',
  ANSWER_ACCEPT: 'answer:accept',
  GAME_CUSTOM_PROMPT: 'game:custom:prompt',
  MODE2_PROMPT: 'mode2:prompt',
  MODE2_DRAW_DONE: 'mode2:draw:done',
  MODE2_ANSWER: 'mode2:answer',
  MODE2_JUDGE_FINAL: 'mode2:judge:final',
  MODE2_VOTE_BEST: 'mode2:vote:best',
} as const satisfies Readonly<Record<string, keyof ClientEvents>>;

export const SERVER_EVENT = {
  ROOM_STATE: 'room:state',
  ROOM_PLAYER_JOIN: 'room:player:join',
  ROOM_PLAYER_LEAVE: 'room:player:leave',
  GAME_ROUND_START: 'game:round:start',
  GAME_ROUND_END: 'game:round:end',
  GAME_END: 'game:end',
  STROKE_REMOTE: 'stroke:remote',
  CHAT_MESSAGE: 'chat:message',
  CHAT_CORRECT: 'chat:correct',
  ANSWER_WRONG: 'answer:wrong',
  MODE2_STEP: 'mode2:step',
  MODE2_REVIEW: 'mode2:review',
  COOKIE_READY: 'cookie:ready',
  ERROR: 'error',
} as const satisfies Readonly<Record<string, keyof ServerEvents>>;

export const SOCKET_NAMESPACE = '/game' as const;

// ─── Presence ────────────────────────────────────────────────────────────────

export type PresenceStatus = 'ONLINE' | 'OFFLINE' | 'IN_LOBBY' | 'IN_GAME';

// IN_LOBBY일 때만 채워지는 방 요약 정보. presence:update가 이 값을 직접 실어 보내므로
// 클라이언트가 별도 REST refetch로 뒤늦게 채울 필요가 없다.
export type PresenceRoomSummary = {
  code: string;
  title: string;
  playerCount: number;
  playerCountMax: number;
  locked: boolean;
  hasPassword: boolean;
  joinable: boolean;
};

export type PresenceClientEvents = {
  'presence:subscribe': (payload: { friendIds: string[] }) => void;
};

// 매칭 로비 이벤트는 presence 소켓으로 보낸다 — 홈(매칭 대기) 화면에는 방 소켓이 없고 presence 소켓은
// 로그인 중 항상 연결되어 있다.
export type PresenceServerEvents = {
  'presence:update': (payload: { userId: string; status: PresenceStatus; room?: PresenceRoomSummary }) => void;
  'match:update': (payload: MatchLobbyUpdate) => void;
  'match:found': (payload: { code: string }) => void;
};

export const PRESENCE_NAMESPACE = '/presence' as const;
