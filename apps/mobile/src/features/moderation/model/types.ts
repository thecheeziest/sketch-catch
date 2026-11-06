// 차단·신고 대상 — 채팅에서 고르면 messageId가 함께 온다
export type ModerationTarget = {
  userId: string;
  nickname: string;
  messageId?: string;
};
