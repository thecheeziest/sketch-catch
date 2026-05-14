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

// 클라이언트 → 서버
export type ClientEvents = {
  auth: { token: string };
  'room:join': { code: string };
  'room:leave': Record<string, never>;
  'room:ready': { ready: boolean };
  'room:start': Record<string, never>;
  'stroke:start': { strokeId: string; color: string; width: number };
  'stroke:append': { strokeId: string; points: Point[] };
  'stroke:end': { strokeId: string };
  'stroke:undo': Record<string, never>;
  'stroke:clear': Record<string, never>;
  'chat:send': { text: string };
  'answer:accept': { messageId: string };
  'mode2:prompt': { sheetId: string; text: string };
  'mode2:draw:done': { sheetId: string };
  'mode2:answer': { sheetId: string; text: string };
  'mode2:vote': { sheetId: string; stepIndex: number; ok: boolean };
  'mode2:vote:best': { sheetId: string };
};

// 서버 → 클라이언트
export type ServerEvents = {
  'room:state': RoomState;
  'room:player:join': { player: Player };
  'room:player:leave': { userId: string };
  'game:round:start': RoundStart;
  'game:round:end': RoundEnd;
  'game:end': GameResult;
  'stroke:remote': StrokeEvent;
  'chat:message': ChatMessage;
  'chat:correct': { userId: string; messageId: string };
  'mode2:step': Mode2Step;
  'mode2:review': Mode2Review;
  'cookie:ready': { sheetId: string };
  error: { code: string; message: string };
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
} as const satisfies Record<string, keyof ClientEvents>;

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
} as const satisfies Record<string, keyof ServerEvents>;

export const SOCKET_NAMESPACE = '/game' as const;
