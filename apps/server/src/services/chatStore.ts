import type { ChatMessage } from '@sketch-catch/shared';

// 재접속 동기화용 게임 채팅 — 방 단위로 보관하고 게임 종료·방 삭제 시 정리한다.
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

// 신고용 최근 채팅 (대기실·게임·시상식 공통) — 방이 사라진 뒤에도 신고할 수 있게 방과 별도로 최근 N개만 보관한다.
// 메모리 전용이라 서버가 재시작되면 원문 없이 신고만 접수된다.
type ReportableMessage = { msg: ChatMessage; code: string };
const MAX_REPORTABLE_MESSAGES = 5000;
const reportable = new Map<string, ReportableMessage>();

export function rememberForReport(code: string, msg: ChatMessage): void {
  reportable.set(msg.id, { msg, code });
  if (reportable.size > MAX_REPORTABLE_MESSAGES) {
    const oldestId = reportable.keys().next().value;
    if (oldestId !== undefined) reportable.delete(oldestId);
  }
}

export function findReportableMessage(messageId: string): ReportableMessage | undefined {
  return reportable.get(messageId);
}

// 재접속한 유저에게 다시 보낼 이번 게임 채팅 (오래된 순)
export function listMessages(code: string): ChatMessage[] {
  return Array.from(store.get(code)?.values() ?? [], stored => stored.msg);
}

export function clearRoomChat(code: string): void {
  store.delete(code);
}
