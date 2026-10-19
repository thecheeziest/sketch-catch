import type { PaintSpan } from '../drawing/paint.js';
import type { Point, Stroke } from '../types/stroke.js';
import type { RoomState, Player } from '../types/room.js';
import type { RoundStart, RoundEnd, GameResult, ChatMessage, Mode2Step, Mode2ReviewState } from '../types/game.js';
import type { StrokeEvent } from '../types/stroke.js';

// 클라이언트 → 서버 (Socket.io EventsMap: 각 이벤트를 함수 시그니처로 정의)
export type ClientEvents = {
  auth: (payload: { token: string }) => void;
  'room:join': (payload: { code: string }) => void;
  'room:leave': () => void;
  'room:ready': (payload: { ready: boolean }) => void;
  'room:start': () => void;
  // 시상식에서 [한번 더!] — 같은 방 대기실로 복귀
  // 소켓이 방에서 빠져 있어도 서버가 응답할 수 있도록 방 코드를 함께 보낸다
  'room:rematch': (payload: { code: string }) => void;
  // 대기실 인원이 시상식에 남은 방장에게 돌아오라고 재촉
  'room:nudge': () => void;
  // 대기실에서 방장이 다른 참가자에게 방장을 넘긴다
  'room:host:transfer': (payload: { targetId: string }) => void;
  'stroke:start': (payload: { strokeId: string; color: string; width: number }) => void;
  'stroke:append': (payload: { strokeId: string; points: Point[] }) => void;
  'stroke:end': (payload: { strokeId: string }) => void;
  'stroke:undo': () => void;
  'stroke:clear': () => void;
  'stroke:fill': (payload: { strokeId: string; color: string; paintSpans: PaintSpan[] }) => void;
  'chat:send': (payload: { text: string }) => void;
  'answer:accept': (payload: { messageId: string }) => void;
  'game:custom:prompt': (payload: { text: string }) => void;
  'mode2:prompt': (payload: { sheetId: string; text: string }) => void;
  'mode2:draw:done': (payload: { sheetId: string; strokes: Stroke[] }) => void; // GIF용 stroke 포함
  'mode2:answer': (payload: { sheetId: string; text: string }) => void;
  // 작성 중인 내용(초안) 동기화 — 시간 초과 시 제출하지 못한 내용을 버리지 않고 자동 제출한다
  'mode2:draft': (payload: { sheetId: string; text?: string; strokes?: Stroke[] }) => void;
};

// 서버 → 클라이언트 (Socket.io EventsMap: 각 이벤트를 함수 시그니처로 정의)
export type ServerEvents = {
  'room:nudged': () => void;
  'room:removed': (payload: { code: string; reason: 'AWARD_EXPIRED' }) => void;
  'room:state': (state: RoomState) => void;
  'room:player:join': (payload: { player: Player }) => void;
  'room:player:leave': (payload: { userId: string }) => void;
  'game:round:start': (payload: RoundStart) => void;
  'game:round:end': (payload: RoundEnd) => void;
  // 남은 시간 10초 — 맞히는 사람에게 제시어 글자 수 공개
  'game:hint': (payload: { gameId: string; roundIndex: number; promptHint: string }) => void;
  'game:end': (payload: GameResult) => void;
  'stroke:remote': (payload: StrokeEvent) => void;
  // 재접속한 소켓에만 — 끊겨 있던 동안 그려진 현재 라운드 그림 전체 (받으면 관전 캔버스를 이 값으로 교체)
  'stroke:sync': (payload: { gameId: string; roundIndex: number; strokes: StrokeEvent[] }) => void;
  'chat:message': (payload: ChatMessage) => void;
  // 재접속한 소켓에만 — 이번 게임 채팅 기록 (받으면 id 기준으로 기존 목록과 합친다)
  'chat:sync': (payload: { gameId: string; messages: ChatMessage[] }) => void;
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
  ROOM_NUDGE: 'room:nudge',
  ROOM_HOST_TRANSFER: 'room:host:transfer',
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
  MODE2_DRAFT: 'mode2:draft',
} as const satisfies Readonly<Record<string, keyof ClientEvents>>;

export const SERVER_EVENT = {
  ROOM_STATE: 'room:state',
  ROOM_NUDGED: 'room:nudged',
  ROOM_PLAYER_JOIN: 'room:player:join',
  ROOM_PLAYER_LEAVE: 'room:player:leave',
  GAME_ROUND_START: 'game:round:start',
  GAME_ROUND_END: 'game:round:end',
  GAME_HINT: 'game:hint',
  GAME_END: 'game:end',
  STROKE_REMOTE: 'stroke:remote',
  STROKE_SYNC: 'stroke:sync',
  CHAT_MESSAGE: 'chat:message',
  CHAT_SYNC: 'chat:sync',
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
