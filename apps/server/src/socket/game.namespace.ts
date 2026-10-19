import type { Server, Namespace, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents } from '@sketch-catch/shared';
import { setPresence } from '../db/redis.js';
import { broadcastPresenceUpdate } from './presence.namespace.js';
import { SERVER_EVENT, SOCKET_NAMESPACE, UPDATE_REQUIRED_CODE } from '@sketch-catch/shared';
import { verifyAccessToken } from '../auth/jwt.js';
import { isOutdatedClient } from '../lib/appVersion.js';
import { logger } from '../lib/logger.js';
import { runInRooms } from '../services/roomQueue.js';
import {
  handleRoomJoin,
  handleRoomLeave,
  handleRoomNudge,
  handleRoomReady,
  handleRoomStart,
} from './handlers/room.js';
import {
  handleStrokeStart,
  handleStrokeAppend,
  handleStrokeEnd,
  handleStrokeUndo,
  handleStrokeClear,
  handleStrokeFill,
} from './handlers/stroke.js';
import { handleChatSend, handleAnswerAccept } from './handlers/chat.js';
import { handleCustomPromptSubmit } from './handlers/game.js';
import { handleMode2Prompt, handleMode2DrawDone, handleMode2Answer, handleMode2Draft } from './handlers/mode2.js';
import { handleRematch } from './handlers/award.js';

declare module 'socket.io' {
  interface SocketData {
    userId: string;
  }
}

type GameNamespace = Namespace<ClientEvents, ServerEvents>;
type GameSocket = Socket<ClientEvents, ServerEvents>;

function roomCodesOf(socket: GameSocket): string[] {
  return Array.from(socket.rooms)
    .filter(r => r.startsWith('room:'))
    .map(r => r.replace('room:', ''));
}

// 모든 소켓 핸들러의 공통 실행기 — 같은 방 작업 줄에서 순서대로 실행하고, 에러가 나도 프로세스를 죽이지 않는다
// (예전엔 `void handler()`라 핸들러 에러 1건이 unhandledRejection으로 서버 전체를 재시작시켰다)
function run(socket: GameSocket, event: string, codes: string[], task: () => Promise<void>): void {
  runInRooms(codes, task).catch(err => {
    logger.error({ err, event, userId: socket.data.userId, codes }, 'socket handler failed');
    socket.emit(SERVER_EVENT.ERROR, { code: 'INTERNAL', message: '잠깐 문제가 생겼어요. 다시 시도해 주세요!' });
  });
}

export function registerGameNamespace(io: Server<ClientEvents, ServerEvents>): void {
  const game = io.of(SOCKET_NAMESPACE) as GameNamespace;

  // JWT 인증 미들웨어 — 모든 소켓 이벤트 전에 인증 강제
  game.use(async (socket, next) => {
    const { platform, build } = socket.handshake.auth as { platform?: unknown; build?: unknown };
    if (isOutdatedClient(platform, build)) return next(new Error(UPDATE_REQUIRED_CODE));

    const token = socket.handshake.auth.token as string | undefined;
    if (!token) return next(new Error('UNAUTHORIZED'));

    const payload = await verifyAccessToken(token);
    if (!payload) return next(new Error('INVALID_TOKEN'));

    socket.data.userId = payload.sub;
    next();
  });

  game.on('connection', socket => {
    // 유저 개인 채널 — 역할별 제시어와 개인 응답을 전달하는 데 쓴다
    void socket.join(`user:${socket.data.userId}`);

    // 현재 소켓이 속한 방의 작업 줄에서 실행 (방에 없으면 핸들러가 스스로 무시한다)
    const inRoom = (event: string, task: () => Promise<void>): void => run(socket, event, roomCodesOf(socket), task);

    socket.on('room:join', ({ code }) => run(socket, 'room:join', [code], () => handleRoomJoin(game, socket, code)));
    socket.on('room:leave', () => inRoom('room:leave', () => handleRoomLeave(game, socket)));
    socket.on('room:ready', ({ ready }) => inRoom('room:ready', () => handleRoomReady(game, socket, ready)));
    socket.on('room:nudge', () => inRoom('room:nudge', () => handleRoomNudge(game, socket)));
    socket.on('room:start', () => inRoom('room:start', () => handleRoomStart(game, socket)));
    socket.on('room:rematch', payload => {
      const code = typeof payload?.code === 'string' ? payload.code : undefined;
      const codes = code ? [code] : roomCodesOf(socket);
      run(socket, 'room:rematch', codes, () => handleRematch(game, socket, code));
    });
    // disconnecting 사용 — disconnect 시점에는 socket.rooms가 이미 비워지므로
    // disconnecting 시점(rooms 아직 유지)에 처리해야 방 코드를 찾을 수 있음
    socket.on('disconnecting', () => {
      const codes = roomCodesOf(socket);
      run(socket, 'disconnecting', codes, async () => {
        await handleRoomLeave(game, socket, codes, { graceful: true });
        const online = await io.of('/presence').in(`user:${socket.data.userId}`).fetchSockets();
        const otherGameSockets = await game.in(`user:${socket.data.userId}`).fetchSockets();
        if (online.length === 0 && !otherGameSockets.some(s => s.id !== socket.id)) {
          await setPresence(socket.data.userId, 'OFFLINE');
          broadcastPresenceUpdate(socket.data.userId, 'OFFLINE');
        }
      });
    });

    // DRAW-03: stroke 이벤트 — 출제자만 broadcast (리터럴 이벤트명 직접 사용 — Phase 4 결정)
    socket.on('stroke:start', payload => inRoom('stroke:start', () => handleStrokeStart(game, socket, payload)));
    socket.on('stroke:append', payload => inRoom('stroke:append', () => handleStrokeAppend(game, socket, payload)));
    socket.on('stroke:end', payload => inRoom('stroke:end', () => handleStrokeEnd(game, socket, payload)));
    socket.on('stroke:undo', () => inRoom('stroke:undo', () => handleStrokeUndo(game, socket)));
    socket.on('stroke:fill', payload => inRoom('stroke:fill', () => handleStrokeFill(game, socket, payload)));
    socket.on('stroke:clear', () => inRoom('stroke:clear', () => handleStrokeClear(game, socket)));

    // GAME-01/MD1-02/MD1-03: 채팅 + 정답 판정
    socket.on('chat:send', payload => inRoom('chat:send', () => handleChatSend(game, socket, payload)));
    socket.on('answer:accept', payload => inRoom('answer:accept', () => handleAnswerAccept(game, socket, payload)));
    socket.on('game:custom:prompt', payload => {
      // 방 작업 줄에서 기다린 시간 때문에 유효한 제출이 시간 초과로 바뀌지 않도록 수신 시각을 보관한다.
      const receivedAt = Date.now();
      inRoom('game:custom:prompt', () => handleCustomPromptSubmit(game, socket, payload, receivedAt));
    });

    // MD2-01/02: 모드2 시트 로테이션 — 리터럴 이벤트명 직접 사용 (Phase 4 결정)
    socket.on('mode2:prompt', payload => inRoom('mode2:prompt', () => handleMode2Prompt(game, socket, payload)));
    socket.on('mode2:draw:done', payload =>
      inRoom('mode2:draw:done', () => handleMode2DrawDone(game, socket, payload)),
    );
    socket.on('mode2:answer', payload => inRoom('mode2:answer', () => handleMode2Answer(game, socket, payload)));
    socket.on('mode2:draft', payload => inRoom('mode2:draft', () => handleMode2Draft(socket, payload)));
  });
}
