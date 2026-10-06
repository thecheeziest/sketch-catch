import type { ChatMessage } from '@sketch-catch/shared';

// answer:accept(출제자 수동 정답 인정) 조회용 최근 채팅 — 방 단위로 보관하고 게임 종료·방 삭제 시 정리한다.
type StoredMessage = { msg: ChatMessage; roundIndex: number };

const MAX_MESSAGES_PER_ROOM = 200;
const store = new Map<string, Map<string, StoredMessage>>();

export function rememberMessage(code: string, msg: ChatMessage, roundIndex: number): void {
  const roomMessages = store.get(code) ?? new Map<string, StoredMessage>();
  roomMessages.set(msg.id, { msg, roundIndex });
  if (roomMessages.size > MAX_MESSAGES_PER_ROOM) {
    const oldestId = roomMessages.keys().next().value;
    if (oldestId !== undefined) roomMessages.delete(oldestId);
  }
  store.set(code, roomMessages);
}

export function findMessage(code: string, messageId: string): StoredMessage | undefined {
  return store.get(code)?.get(messageId);
}

export function clearRoomChat(code: string): void {
  store.delete(code);
}
