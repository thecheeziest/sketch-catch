import type { Namespace, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents, ChatMessage, Mode1RoundCurrent, RoomState } from '@sketch-catch/shared';
import { SERVER_EVENT } from '@sketch-catch/shared';
import { randomUUID } from 'node:crypto';
import { getRoomState } from '../../services/rooms.service.js';
import { profanityFilter } from '../../services/profanity.js';
import { findMessage, rememberMessage } from '../../services/chatStore.js';
import { endRound } from './game.js';

type GameNamespace = Namespace<ClientEvents, ServerEvents>;
type GameSocket = Socket<ClientEvents, ServerEvents, Record<string, never>, { userId: string }>;

// 띄어쓰기 차이는 오답으로 보지 않는다 (정답 '오징어 게임' ← '오징어게임' 인정)
function isCorrectAnswer(answer: string, prompt: string): boolean {
  const normalize = (text: string): string => text.replace(/\s+/gu, '');
  const normalizedPrompt = normalize(prompt);
  return normalizedPrompt.length > 0 && normalize(answer) === normalizedPrompt;
}

// 정답 판정 없는 자유 채팅 장소 — 시상식에 남은 유저는 방 상태와 무관하게 시상식 채널, 그 외는 대기실에서만 가능
function resolveFreeChatChannel(inAward: boolean, status: RoomState['status']): 'AWARD' | 'LOBBY' | null {
  if (inAward) return 'AWARD';
  return status === 'LOBBY' ? 'LOBBY' : null;
}

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

  // 대기실·시상식 — 정답 판정 없는 자유 채팅. 같은 장소(대기실 / 시상식)에 있는 인원에게만 전달한다.
  // 시상식 채팅은 다른 유저가 [한번 더]로 대기실을 열어도 시상식에 남은 사람끼리 계속 이어진다.
  const awardViewers = state.awardViewers ?? [];
  const sender =
    state.players.find(p => p.id === socket.data.userId) ?? awardViewers.find(p => p.id === socket.data.userId);
  if (sender && !sender.left) {
    const isViewer = awardViewers.some(p => p.id === sender.id);
    const channel = resolveFreeChatChannel(isViewer || sender.inAward === true, state.status);
    if (channel) {
      const trimmed = payload.text.trim().slice(0, 30);
      if (trimmed.length === 0) return;
      const { masked } = profanityFilter(trimmed);
      const msg: ChatMessage = {
        id: randomUUID(),
        userId: sender.id,
        nickname: sender.nickname,
        characterId: sender.characterId,
        chatColorId: sender.chatColorId ?? null,
        text: masked,
        masked: masked !== trimmed,
        createdAt: Date.now(),
        channel,
      };
      const audience =
        channel === 'AWARD'
          ? [...state.players.filter(p => p.inAward === true), ...awardViewers]
          : state.players.filter(p => p.inAward !== true);
      for (const p of audience) {
        if (p.left) continue;
        game.to(`user:${p.id}`).emit(SERVER_EVENT.CHAT_MESSAGE, msg);
      }
      return;
    }
  }

  if (state.status !== 'MODE1_ROUND_START') return;
  const participant = state.players.find(p => p.id === socket.data.userId);
  if (!participant || participant.left || participant.inAward) return;

  // 라운드 정보가 아직 없으면 무시 — null 접근으로 서버가 죽던 문제(R8) 방어
  const current = state.current as Mode1RoundCurrent | null;
  if (!current) return;

  // GAME-01: 출제자 채팅 차단
  if (socket.data.userId === current.drawerId) return;

  // GAME-01: 30자 제한 + 빈 문자열 필터
  const trimmed = payload.text.trim().slice(0, 30);
  if (trimmed.length === 0) return;

  // GAME-01: 비속어 필터
  const { masked } = profanityFilter(trimmed);

  const msg: ChatMessage = {
    id: randomUUID(),
    userId: socket.data.userId,
    nickname: participant.nickname,
    characterId: participant.characterId,
    chatColorId: participant.chatColorId ?? null,
    text: masked,
    masked: masked !== trimmed,
    createdAt: Date.now(),
  };

  // answer:accept 조회용 저장 — 방·라운드 단위
  rememberMessage(code, msg, current.roundIndex);

  // chat:message broadcast (발신자 포함 — 본인 말풍선도 표시)
  game.to(`room:${code}`).emit(SERVER_EVENT.CHAT_MESSAGE, msg);

  // MD1-02: 정답 자동 판정 (D-06: 서버에서만 수행)
  if (isCorrectAnswer(trimmed, current.prompt)) {
    game
      .to(`room:${code}`)
      .emit(SERVER_EVENT.CHAT_CORRECT, { gameId: state.gameId ?? '', userId: socket.data.userId, messageId: msg.id });
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

  const current = state.current as Mode1RoundCurrent | null;
  if (!current) return;

  // MD1-03: 출제자만 수동 인정 가능
  if (socket.data.userId !== current.drawerId) return;

  const stored = findMessage(code, payload.messageId);
  // 없거나, 지난 라운드 메시지거나, 출제자 자기 인정 방지
  if (!stored || stored.roundIndex !== current.roundIndex) return;
  const msg = stored.msg;
  if (msg.userId === current.drawerId) return;

  game
    .to(`room:${code}`)
    .emit(SERVER_EVENT.CHAT_CORRECT, { gameId: state.gameId ?? '', userId: msg.userId, messageId: msg.id });
  await endRound(game, code, current.roundIndex, msg.userId, Date.now() - current.startedAt);
}
