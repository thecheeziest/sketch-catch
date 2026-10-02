import type { Namespace, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents, ChatMessage, Mode1RoundCurrent } from '@sketch-catch/shared';
import { SERVER_EVENT } from '@sketch-catch/shared';
import { randomUUID } from 'node:crypto';
import { getRoomState } from '../../services/rooms.service.js';
import { profanityFilter } from '../../services/profanity.js';
import { endRound } from './game.js';

type GameNamespace = Namespace<ClientEvents, ServerEvents>;
type GameSocket = Socket<ClientEvents, ServerEvents, Record<string, never>, { userId: string }>;

// answer:accept 조회용 — 최근 메시지 보관 (messageId → ChatMessage)
const recentMessages = new Map<string, ChatMessage>();

export async function handleChatSend(
  game: GameNamespace,
  socket: GameSocket,
  payload: { text: string },
): Promise<void> {
  const roomName = Array.from(socket.rooms).find((r) => r.startsWith('room:'));
  if (!roomName) return;
  const code = roomName.replace('room:', '');

  const state = await getRoomState(code);
  if (!state) return;

  // 게임 종료(시상) 화면 — 정답 판정 없는 자유 채팅. 발신자 포함 브로드캐스트만 수행한다.
  if (state.status === 'AWARD') {
    const trimmed = payload.text.trim().slice(0, 30);
    if (trimmed.length === 0) return;
    const { masked } = profanityFilter(trimmed);
    const player = state.players.find((p) => p.id === socket.data.userId);
    const msg: ChatMessage = {
      id: randomUUID(),
      userId: socket.data.userId,
      nickname: player?.nickname ?? '',
      text: masked,
      masked: masked !== trimmed,
      createdAt: Date.now(),
    };
    game.to(`room:${code}`).emit(SERVER_EVENT.CHAT_MESSAGE, msg);
    return;
  }

  if (state.status !== 'MODE1_ROUND_START') return;

  const current = state.current as Mode1RoundCurrent;

  // GAME-01: 출제자 채팅 차단
  if (socket.data.userId === current.drawerId) return;

  // GAME-01: 30자 제한 + 빈 문자열 필터
  const trimmed = payload.text.trim().slice(0, 30);
  if (trimmed.length === 0) return;

  // GAME-01: 비속어 필터
  const { masked } = profanityFilter(trimmed);

  const player = state.players.find((p) => p.id === socket.data.userId);
  const msg: ChatMessage = {
    id: randomUUID(),
    userId: socket.data.userId,
    nickname: player?.nickname ?? '',
    text: masked,
    masked: masked !== trimmed,
    createdAt: Date.now(),
  };

  // answer:accept 조회용 저장
  recentMessages.set(msg.id, msg);

  // chat:message broadcast (발신자 포함 — 본인 말풍선도 표시)
  game.to(`room:${code}`).emit(SERVER_EVENT.CHAT_MESSAGE, msg);

  // MD1-02: 정답 자동 판정 (D-06: 서버에서만 수행)
  if (trimmed === current.prompt.trim()) {
    game
      .to(`room:${code}`)
      .emit(SERVER_EVENT.CHAT_CORRECT, { userId: socket.data.userId, messageId: msg.id });
    await endRound(game, code, current.roundIndex, socket.data.userId, Date.now() - current.startedAt);
  } else {
    // 오답 피드백은 제출자 본인에게만 전달 (다른 플레이어의 채팅 로그는 chat:message로 충분)
    // roundIndex를 함께 보내 클라이언트가 라운드 전환 후 도착한 응답(이전 라운드 오답)을 구분하게 한다.
    socket.emit(SERVER_EVENT.ANSWER_WRONG, { messageId: msg.id, roundIndex: current.roundIndex });
  }
}

export async function handleAnswerAccept(
  game: GameNamespace,
  socket: GameSocket,
  payload: { messageId: string },
): Promise<void> {
  const roomName = Array.from(socket.rooms).find((r) => r.startsWith('room:'));
  if (!roomName) return;
  const code = roomName.replace('room:', '');

  const state = await getRoomState(code);
  if (!state || state.status !== 'MODE1_ROUND_START') return;

  const current = state.current as Mode1RoundCurrent;

  // MD1-03: 출제자만 수동 인정 가능
  if (socket.data.userId !== current.drawerId) return;

  const msg = recentMessages.get(payload.messageId);
  // 없거나 출제자 자기 인정 방지
  if (!msg || msg.userId === current.drawerId) return;

  game
    .to(`room:${code}`)
    .emit(SERVER_EVENT.CHAT_CORRECT, { userId: msg.userId, messageId: msg.id });
  await endRound(game, code, current.roundIndex, msg.userId, Date.now() - current.startedAt);
}
