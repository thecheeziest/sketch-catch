import type { Server, Namespace } from 'socket.io';
import type { PresenceClientEvents, PresenceServerEvents, PresenceStatus } from '@sketch-catch/shared';
import { PRESENCE_NAMESPACE } from '@sketch-catch/shared';
import { verifyAccessToken } from '../auth/jwt.js';
import { getPresence } from '../db/redis.js';

type PresenceNamespace = Namespace<PresenceClientEvents, PresenceServerEvents>;

let ns: PresenceNamespace | null = null;

export function registerPresenceNamespace(io: Server): void {
  ns = io.of(PRESENCE_NAMESPACE) as PresenceNamespace;

  ns.use(async (socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) return next(new Error('UNAUTHORIZED'));
    const payload = await verifyAccessToken(token);
    if (!payload) return next(new Error('INVALID_TOKEN'));
    socket.data.userId = payload.sub;
    next();
  });

  ns.on('connection', (socket) => {
    const userId = socket.data.userId;
    console.log(`[presence] connected: ${userId}`);

    socket.on('presence:subscribe', ({ friendIds }) => {
      console.log(`[presence] ${userId} subscribing to`, friendIds);
      void (async () => {
        for (const friendId of friendIds) {
          await socket.join(`presence_of:${friendId}`);
          // 구독 즉시 현재 상태 전송 — 이전 broadcast를 놓쳤더라도 최신 값 수신
          const status = await getPresence(friendId);
          socket.emit('presence:update', { userId: friendId, status });
          console.log(`[presence] snapshot sent: ${friendId} → ${status}`);
        }
      })();
    });

    socket.on('disconnect', () => {
      console.log(`[presence] disconnected: ${userId}`);
    });
  });
}

// 상태가 변경되는 모든 지점(인증 미들웨어, 방 소켓 핸들러, REST 라우트)에서 호출
export function broadcastPresenceUpdate(userId: string, status: PresenceStatus): void {
  if (!ns) return;
  console.log(`[presence] broadcast: ${userId} → ${status}`);
  ns.to(`presence_of:${userId}`).emit('presence:update', { userId, status });
}
