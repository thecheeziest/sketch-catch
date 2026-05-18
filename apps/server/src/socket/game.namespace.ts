import type { Server, Namespace } from 'socket.io';
import type { ClientEvents, ServerEvents } from '@sketch-catch/shared';
import { SOCKET_NAMESPACE } from '@sketch-catch/shared';
import { verifyAccessToken } from '../auth/jwt.js';
import { handleRoomJoin, handleRoomLeave, handleRoomReady, handleRoomStart } from './handlers/room.js';

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
    // Pitfall 4 회피: disconnect 시에도 handleRoomLeave 호출
    socket.on('disconnect', () => void handleRoomLeave(game, socket));
  });
}
