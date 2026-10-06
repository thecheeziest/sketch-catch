import type { Namespace, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents, Mode1RoundCurrent, Point } from '@sketch-catch/shared';
import { SERVER_EVENT } from '@sketch-catch/shared';
import { getRoomState } from '../../services/rooms.service.js';

type GameNamespace = Namespace<ClientEvents, ServerEvents>;
type GameSocket = Socket<ClientEvents, ServerEvents, Record<string, never>, { userId: string }>;

// 출제자 권한 검증 — MODE1_ROUND_START 상태이고 현재 출제자일 때만 통과
async function assertDrawer(socket: GameSocket): Promise<{ roomName: string; code: string } | null> {
  const roomName = Array.from(socket.rooms).find((r) => r.startsWith('room:'));
  if (!roomName) return null;

  const code = roomName.replace('room:', '');
  const state = await getRoomState(code);
  if (!state || state.status !== 'MODE1_ROUND_START') return null;

  const current = state.current as Mode1RoundCurrent | null;
  // DRAW-03: 출제자가 아닌 경우 조용히 거부 (보안 원칙 — 서버가 진실의 출처)
  if (!current || current.drawerId !== socket.data.userId) return null;

  return { roomName, code };
}

export async function handleStrokeStart(
  _game: GameNamespace,
  socket: GameSocket,
  payload: { strokeId: string; color: string; width: number },
): Promise<void> {
  const ctx = await assertDrawer(socket);
  if (!ctx) return;

  // authorId는 반드시 socket.data.userId — 클라이언트 입력 신뢰 금지
  socket.to(ctx.roomName).emit(SERVER_EVENT.STROKE_REMOTE, {
    strokeId: payload.strokeId,
    authorId: socket.data.userId,
    color: payload.color,
    width: payload.width,
  });
}

export async function handleStrokeAppend(
  _game: GameNamespace,
  socket: GameSocket,
  payload: { strokeId: string; points: Point[] },
): Promise<void> {
  const ctx = await assertDrawer(socket);
  if (!ctx) return;

  socket.to(ctx.roomName).emit(SERVER_EVENT.STROKE_REMOTE, {
    strokeId: payload.strokeId,
    authorId: socket.data.userId,
    points: payload.points,
  });
}

export async function handleStrokeEnd(
  _game: GameNamespace,
  socket: GameSocket,
  payload: { strokeId: string },
): Promise<void> {
  const ctx = await assertDrawer(socket);
  if (!ctx) return;

  socket.to(ctx.roomName).emit(SERVER_EVENT.STROKE_REMOTE, {
    strokeId: payload.strokeId,
    authorId: socket.data.userId,
    ended: true,
  });
}

export async function handleStrokeUndo(
  _game: GameNamespace,
  socket: GameSocket,
): Promise<void> {
  const ctx = await assertDrawer(socket);
  if (!ctx) return;

  // '__undo__' 마커: 관전자 캔버스에서 마지막 stroke 제거 신호
  socket.to(ctx.roomName).emit(SERVER_EVENT.STROKE_REMOTE, {
    strokeId: '__undo__',
    authorId: socket.data.userId,
    ended: true,
  });
}

export async function handleStrokeClear(
  _game: GameNamespace,
  socket: GameSocket,
): Promise<void> {
  const ctx = await assertDrawer(socket);
  if (!ctx) return;

  // '__clear__' 마커: 관전자 캔버스 전체 초기화 신호
  socket.to(ctx.roomName).emit(SERVER_EVENT.STROKE_REMOTE, {
    strokeId: '__clear__',
    authorId: socket.data.userId,
    ended: true,
  });
}
