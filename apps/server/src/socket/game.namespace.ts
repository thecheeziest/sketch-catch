import type { Server, Namespace } from 'socket.io';
import type { ClientEvents, ServerEvents } from '@sketch-catch/shared';
import { SOCKET_NAMESPACE } from '@sketch-catch/shared';
import { verifyAccessToken } from '../auth/jwt.js';
import { handleRoomJoin, handleRoomLeave, handleRoomReady, handleRoomStart } from './handlers/room.js';
import { handleStrokeStart, handleStrokeAppend, handleStrokeEnd, handleStrokeUndo, handleStrokeClear } from './handlers/stroke.js';
import { handleChatSend, handleAnswerAccept } from './handlers/chat.js';
import { handleCustomPromptSubmit } from './handlers/game.js';
import { handleMode2Prompt, handleMode2DrawDone, handleMode2Answer } from './handlers/mode2.js';
import { handleMode2JudgeFinal, handleMode2VoteBest } from './handlers/mode2-review.js';

declare module 'socket.io' {
  interface SocketData {
    userId: string;
  }
}

export function registerGameNamespace(io: Server<ClientEvents, ServerEvents>): void {
  const game = io.of(SOCKET_NAMESPACE) as Namespace<ClientEvents, ServerEvents>;

  // JWT 인증 미들웨어 — 모든 소켓 이벤트 전에 인증 강제
  game.use(async (socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) return next(new Error('UNAUTHORIZED'));

    const payload = await verifyAccessToken(token);
    if (!payload) return next(new Error('INVALID_TOKEN'));

    socket.data.userId = payload.sub;
    next();
  });

  game.on('connection', (socket) => {
    socket.on('room:join', ({ code }) => void handleRoomJoin(game, socket, code));
    socket.on('room:leave', () => void handleRoomLeave(game, socket));
    socket.on('room:ready', ({ ready }) => void handleRoomReady(game, socket, ready));
    socket.on('room:start', () => void handleRoomStart(game, socket));
    // disconnecting 사용 — disconnect 시점에는 socket.rooms가 이미 비워지므로
    // disconnecting 시점(rooms 아직 유지)에 처리해야 방 코드를 찾을 수 있음
    socket.on('disconnecting', () => void handleRoomLeave(game, socket));

    // DRAW-03: stroke 이벤트 — 출제자만 broadcast (리터럴 이벤트명 직접 사용 — Phase 4 결정)
    socket.on('stroke:start', (payload) => void handleStrokeStart(game, socket, payload));
    socket.on('stroke:append', (payload) => void handleStrokeAppend(game, socket, payload));
    socket.on('stroke:end', (payload) => void handleStrokeEnd(game, socket, payload));
    socket.on('stroke:undo', () => void handleStrokeUndo(game, socket));
    socket.on('stroke:clear', () => void handleStrokeClear(game, socket));

    // GAME-01/MD1-02/MD1-03: 채팅 + 정답 판정
    socket.on('chat:send', (payload) => void handleChatSend(game, socket, payload));
    socket.on('answer:accept', (payload) => void handleAnswerAccept(game, socket, payload));
    socket.on('game:custom:prompt', (payload) => void handleCustomPromptSubmit(game, socket, payload));

    // MD2-01/02: 모드2 시트 로테이션 — 리터럴 이벤트명 직접 사용 (Phase 4 결정)
    socket.on('mode2:prompt', (payload) => void handleMode2Prompt(game, socket, payload));
    socket.on('mode2:draw:done', (payload) => void handleMode2DrawDone(game, socket, payload));
    socket.on('mode2:answer', (payload) => void handleMode2Answer(game, socket, payload));

    // MD2-03/04: 리뷰 최종 판정 + 베스트 시트 투표 — 리터럴 이벤트명 직접 사용 (Phase 4 결정)
    socket.on('mode2:judge:final', (payload) => void handleMode2JudgeFinal(game, socket, payload));
    socket.on('mode2:vote:best', (payload) => void handleMode2VoteBest(game, socket, payload));
  });
}
