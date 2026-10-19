import type { Namespace, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents, Mode1RoundCurrent, Point, StrokeEvent } from '@sketch-catch/shared';
import { paintSpansSchema, SERVER_EVENT } from '@sketch-catch/shared';
import { getRoomState } from '../../services/rooms.service.js';
import { recordStroke, strokeRoundKey } from '../../services/strokeStore.js';

type GameNamespace = Namespace<ClientEvents, ServerEvents>;
type GameSocket = Socket<ClientEvents, ServerEvents, Record<string, never>, { userId: string }>;

// 출제자 권한 검증 — MODE1_ROUND_START 상태이고 현재 출제자일 때만 통과
type DrawerContext = { roomName: string; code: string; roundKey: string };

async function assertDrawer(socket: GameSocket): Promise<DrawerContext | null> {
  const roomName = Array.from(socket.rooms).find(r => r.startsWith('room:'));
  if (!roomName) return null;

  const code = roomName.replace('room:', '');
  const state = await getRoomState(code);
  if (!state || state.status !== 'MODE1_ROUND_START') return null;

  const current = state.current as Mode1RoundCurrent | null;
  // DRAW-03: 출제자가 아닌 경우 조용히 거부 (보안 원칙 — 서버가 진실의 출처)
  if (!current || current.prompt === '' || current.drawerId !== socket.data.userId) return null;

  return { roomName, code, roundKey: strokeRoundKey(state.gameId, current.roundIndex) };
}

// 관전자에게 전달하면서 재접속 복구용으로 현재 라운드 그림에도 기록한다
function relay(socket: GameSocket, ctx: DrawerContext, event: StrokeEvent): void {
  recordStroke(ctx.code, ctx.roundKey, event);
  socket.to(ctx.roomName).emit(SERVER_EVENT.STROKE_REMOTE, event);
}

export async function handleStrokeStart(
  _game: GameNamespace,
  socket: GameSocket,
  payload: { strokeId: string; color: string; width: number },
): Promise<void> {
  const ctx = await assertDrawer(socket);
  if (!ctx) return;

  // authorId는 반드시 socket.data.userId — 클라이언트 입력 신뢰 금지
  relay(socket, ctx, {
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

  relay(socket, ctx, {
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

  relay(socket, ctx, {
    strokeId: payload.strokeId,
    authorId: socket.data.userId,
    ended: true,
  });
}

export async function handleStrokeUndo(_game: GameNamespace, socket: GameSocket): Promise<void> {
  const ctx = await assertDrawer(socket);
  if (!ctx) return;

  // '__undo__' 마커: 관전자 캔버스에서 마지막 stroke 제거 신호
  relay(socket, ctx, {
    strokeId: '__undo__',
    authorId: socket.data.userId,
    ended: true,
  });
}

export async function handleStrokeClear(_game: GameNamespace, socket: GameSocket): Promise<void> {
  const ctx = await assertDrawer(socket);
  if (!ctx) return;

  // '__clear__' 마커: 관전자 캔버스 전체 초기화 신호
  relay(socket, ctx, {
    strokeId: '__clear__',
    authorId: socket.data.userId,
    ended: true,
  });
}

export async function handleStrokeFill(_game: GameNamespace, socket: GameSocket, payload: unknown): Promise<void> {
  const ctx = await assertDrawer(socket);
  if (!ctx || typeof payload !== 'object' || payload === null) return;
  const data = payload as Record<string, unknown>;
  if (typeof data.strokeId !== 'string' || data.strokeId.length > 100) return;
  if (typeof data.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(data.color)) return;
  const parsed = paintSpansSchema.safeParse(data.paintSpans);
  if (!parsed.success) return;
  relay(socket, ctx, {
    strokeId: data.strokeId,
    authorId: socket.data.userId,
    color: data.color,
    width: 0,
    paintSpans: parsed.data,
    ended: true,
  });
}
