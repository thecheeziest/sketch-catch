import type { Server, Namespace } from 'socket.io';
import type {
  PresenceClientEvents,
  PresenceServerEvents,
  PresenceStatus,
  ClientEvents,
  ServerEvents,
} from '@sketch-catch/shared';
import { PRESENCE_NAMESPACE, UPDATE_REQUIRED_CODE } from '@sketch-catch/shared';
import { verifyAccessToken } from '../auth/jwt.js';
import { isOutdatedClient } from '../lib/appVersion.js';
import { getPresence, getUserRoom, setPresence } from '../db/redis.js';
import { getFriendRoomView } from '../services/friends.service.js';

import { handleRoomLeave } from './handlers/room.js';
import { getRoomState } from '../services/rooms.service.js';
import { runInRooms } from '../services/roomQueue.js';

type PresenceNamespace = Namespace<PresenceClientEvents, PresenceServerEvents>;

let ns: PresenceNamespace | null = null;

export function registerPresenceNamespace(io: Server): void {
  ns = io.of(PRESENCE_NAMESPACE) as PresenceNamespace;

  ns.use(async (socket, next) => {
    const { platform, build } = socket.handshake.auth as { platform?: unknown; build?: unknown };
    if (isOutdatedClient(platform, build)) return next(new Error(UPDATE_REQUIRED_CODE));

    const token = socket.handshake.auth.token as string | undefined;
    if (!token) return next(new Error('UNAUTHORIZED'));
    const payload = await verifyAccessToken(token);
    if (!payload) return next(new Error('INVALID_TOKEN'));
    socket.data.userId = payload.sub;
    next();
  });

  ns.on('connection', socket => {
    const userId = socket.data.userId;
    console.log(`[presence] connected: ${userId}`);
    // 유저 개인 채널 — 방에 들어가기 전(매칭 대기 등)에도 이 유저에게 push할 수 있다
    void socket.join(`user:${userId}`);

    const game = io.of('/game') as Namespace<ClientEvents, ServerEvents>;
    const refresh = async (): Promise<void> => {
      const code = await getUserRoom(userId);
      await runInRooms(code ? [code] : [], async () => {
        if (!socket.connected) return;
        const currentCode = await getUserRoom(userId);
        // 현재 방이 바뀌었으면 다음 갱신에서 처리한다.
        if (currentCode !== code) return;
        const active = code ? await game.in(`room:${code}`).fetchSockets() : [];
        if (code && !active.some(s => s.data.userId === userId)) {
          await handleRoomLeave(
            game,
            { id: socket.id, data: { userId }, rooms: new Set(), leave: async () => undefined },
            [code],
          );
        }
        const state = code ? await getRoomState(code) : null;
        const player = state?.players.find(p => p.id === userId && p.connected && !p.left);
        let status: PresenceStatus = 'ONLINE';
        if (player && active.some(s => s.data.userId === userId)) {
          status = state?.status === 'LOBBY' || (state?.status === 'AWARD' && !player.inAward) ? 'IN_LOBBY' : 'IN_GAME';
        }
        await setPresence(userId, status);
        broadcastPresenceUpdate(userId, status);
      });
    };
    // 재연결 시 방 소켓의 복구가 먼저 완료될 여유를 준다. 앱 재실행 시 남은 참가자도 정리한다.
    const reconnectTimer = setTimeout(() => {
      void refresh().catch(err => console.error('[presence] reconcile failed', err));
    }, 1500);
    const heartbeat = setInterval(() => {
      void refresh().catch(err => console.error('[presence] refresh failed', err));
    }, 60_000);

    socket.on('presence:subscribe', ({ friendIds }) => {
      console.log(`[presence] ${userId} subscribing to`, friendIds);
      void (async () => {
        for (const friendId of friendIds) {
          await socket.join(`presence_of:${friendId}`);
          // 구독 즉시 현재 상태 전송 — 이전 broadcast를 놓쳤더라도 최신 값(room 포함) 수신
          const baseStatus = await getPresence(friendId);
          const { presenceStatus, room } = await getFriendRoomView(friendId, baseStatus);
          socket.emit('presence:update', { userId: friendId, status: presenceStatus, room });
          console.log(`[presence] snapshot sent: ${friendId} → ${presenceStatus}`);
        }
      })();
    });

    socket.on('disconnect', () => {
      clearTimeout(reconnectTimer);
      clearInterval(heartbeat);
      console.log(`[presence] disconnected: ${userId}`);
      void (async () => {
        const connected = await ns!.in(`user:${userId}`).fetchSockets();
        const gameSockets = await game.in(`user:${userId}`).fetchSockets();
        if (connected.length > 0 || gameSockets.length > 0) return;
        await setPresence(userId, 'OFFLINE');
        broadcastPresenceUpdate(userId, 'OFFLINE');
      })().catch(err => console.error('[presence] disconnect failed', err));
    });
  });
}

// 특정 유저에게만 push (매칭 로비 업데이트·매칭 완료). presence 소켓은 로그인 중 항상 연결되어 있다.
export function emitToPresenceUser<E extends keyof PresenceServerEvents>(
  userId: string,
  event: E,
  ...args: Parameters<PresenceServerEvents[E]>
): void {
  if (!ns) return;
  ns.to(`user:${userId}`).emit(event, ...args);
}

// 상태가 변경되는 모든 지점(인증 미들웨어, 방 소켓 핸들러, REST 라우트)에서 호출.
// room 정보를 broadcast 시점에 서버에서 직접 계산해 함께 보낸다 — 구독자별 REST refetch에
// 의존하면 응답 속도 차이로 일부 친구에게만 방 정보가 늦게(또는 누락되어) 반영되는 레이스가 생긴다.
export function broadcastPresenceUpdate(userId: string, status: PresenceStatus): void {
  if (!ns) return;
  const target = ns;
  void (async () => {
    const { presenceStatus, room } = await getFriendRoomView(userId, status);
    console.log(`[presence] broadcast: ${userId} → ${presenceStatus}`);
    target.to(`presence_of:${userId}`).emit('presence:update', { userId, status: presenceStatus, room });
  })();
}
