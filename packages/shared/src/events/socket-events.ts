import type { Point } from '../types/stroke.js';
import type { RoomState, Player } from '../types/room.js';
import type {
  RoundStart,
  RoundEnd,
  GameResult,
  ChatMessage,
  Mode2Step,
  Mode2Review,
} from '../types/game.js';
import type { StrokeEvent } from '../types/stroke.js';

// 클라이언트 → 서버 (Socket.io EventsMap: 각 이벤트를 함수 시그니처로 정의)
export type ClientEvents = {
  auth: (payload: { token: string }) => void;
  'room:join': (payload: { code: string }) => void;
  'room:leave': () => void;
  'room:ready': (payload: { ready: boolean }) => void;
  'room:start': () => void;
  'stroke:start': (payload: { strokeId: string; color: string; width: number }) => void;
  'stroke:append': (payload: { strokeId: string; points: Point[] }) => void;
  'stroke:end': (payload: { strokeId: string }) => void;
  'stroke:undo': () => void;
  'stroke:clear': () => void;
  'chat:send': (payload: { text: string }) => void;
  'answer:accept': (payload: { messageId: string }) => void;
  'mode2:prompt': (payload: { sheetId: string; text: string }) => void;
  'mode2:draw:done': (payload: { sheetId: string }) => void;
  'mode2:answer': (payload: { sheetId: string; text: string }) => void;
  'mode2:vote': (payload: { sheetId: string; stepIndex: number; ok: boolean }) => void;
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
  'chat:correct': (payload: { userId: string; messageId: string }) => void;
  'mode2:step': (payload: Mode2Step) => void;
  'mode2:review': (payload: Mode2Review) => void;
  'cookie:ready': (payload: { sheetId: string }) => void;
  error: (payload: { code: string; message: string }) => void;
};

// 문자열 상수 — emit/on에서 매직 스트링 방지
export const CLIENT_EVENT = {
  AUTH: 'auth',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_READY: 'room:ready',
  ROOM_START: 'room:start',
  STROKE_START: 'stroke:start',
  STROKE_APPEND: 'stroke:append',
  STROKE_END: 'stroke:end',
  STROKE_UNDO: 'stroke:undo',
  STROKE_CLEAR: 'stroke:clear',
  CHAT_SEND: 'chat:send',
  ANSWER_ACCEPT: 'answer:accept',
  MODE2_PROMPT: 'mode2:prompt',
  MODE2_DRAW_DONE: 'mode2:draw:done',
  MODE2_ANSWER: 'mode2:answer',
  MODE2_VOTE: 'mode2:vote',
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
  MODE2_STEP: 'mode2:step',
  MODE2_REVIEW: 'mode2:review',
  COOKIE_READY: 'cookie:ready',
  ERROR: 'error',
} as const satisfies Readonly<Record<string, keyof ServerEvents>>;

export const SOCKET_NAMESPACE = '/game' as const;
