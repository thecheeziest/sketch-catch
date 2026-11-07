import { useCallback, useMemo } from 'react';
import { useBlockedUsers } from '../api';

export const BLOCKED_CHAT_TEXT = '차단한 사용자의 채팅이에요';

// 차단한 유저의 채팅은 내 화면에서만 가린다 — 정답 판정 등 게임 진행은 그대로 둔다
export function useBlockedChatText() {
  const { data: blockedUsers } = useBlockedUsers();
  const blockedIds = useMemo(() => new Set(blockedUsers?.map(user => user.userId)), [blockedUsers]);

  return useCallback(
    (message: { userId: string; text: string }): string =>
      blockedIds.has(message.userId) ? BLOCKED_CHAT_TEXT : message.text,
    [blockedIds],
  );
}
