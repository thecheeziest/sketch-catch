import type { Namespace, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents, Mode1RoundCurrent, Point, StrokeEvent } from '@sketch-catch/shared';
import { paintSpansSchema, SERVER_EVENT } from '@sketch-catch/shared';
import { z } from 'zod';
import { getRoomState } from '../../services/rooms.service.js';
import { recordStroke, strokeRoundKey } from '../../services/strokeStore.js';

type GameNamespace = Namespace<ClientEvents, ServerEvents>;
type GameSocket = Pick<Socket<ClientEvents, ServerEvents, Record<string, never>, { userId: string }>, 'data' | 'rooms' | 'to'>;

// 관전자 화면으로 그대로 전달되는 값이라 형식·크기를 서버에서 제한한다
// width: 새 앱은 캔버스 너비 대비 비율(0~1), 구버전 앱은 px(1~64)을 보낸다
const strokeIdSchema = z.string().min(1).max(100);
const strokeStartSchema = z.object({
  strokeId: strokeIdSchema,
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  width: z.number().finite().positive().max(128),
});
const strokeAppendSchema = z.object({
  strokeId: strokeIdSchema,
  points: z.array(z.object({ x: z.number().finite(), y: z.number().finite(), t: z.number().finite() })).max(1000),
});
const strokeEndSchema = z.object({ strokeId: strokeIdSchema });

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

export async function handleStrokeStart(_game: GameNamespace, socket: GameSocket, payload: unknown): Promise<void> {
  const parsed = strokeStartSchema.safeParse(payload);
  if (!parsed.success) return;
  const ctx = await assertDrawer(socket);
  if (!ctx) return;

  // authorId는 반드시 socket.data.userId — 클라이언트 입력 신뢰 금지
  relay(socket, ctx, {
    strokeId: parsed.data.strokeId,
    authorId: socket.data.userId,
    color: parsed.data.color,
    width: parsed.data.width,
  });
}

export async function handleStrokeAppend(_game: GameNamespace, socket: GameSocket, payload: unknown): Promise<void> {
  const parsed = strokeAppendSchema.safeParse(payload);
  if (!parsed.success) return;
  const ctx = await assertDrawer(socket);
  if (!ctx) return;

  const points: Point[] = parsed.data.points;
  relay(socket, ctx, {
    strokeId: parsed.data.strokeId,
    authorId: socket.data.userId,
    points,
  });
}

export async function handleStrokeEnd(_game: GameNamespace, socket: GameSocket, payload: unknown): Promise<void> {
  const parsed = strokeEndSchema.safeParse(payload);
  if (!parsed.success) return;
  const ctx = await assertDrawer(socket);
  if (!ctx) return;

  relay(socket, ctx, {
    strokeId: parsed.data.strokeId,
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
