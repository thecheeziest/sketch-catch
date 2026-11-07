import { useCallback } from 'react';
import { useAuthStore } from '@/shared/model';
import { useBlockedChatText } from './useBlockedChatText';
import { useUserModeration } from './useUserModeration';

type ChatLike = { id: string; userId: string; nickname: string };

// 채팅 화면 공통 — 차단한 유저 채팅 가리기 + 남의 말풍선 길게 누르면 차단·신고 메뉴
export function useChatModeration() {
  const myId = useAuthStore(s => s.user?.id);
  const textOf = useBlockedChatText();
  const { openChatActions } = useUserModeration();

  const onLongPressChat = useCallback(
    (message: ChatLike): void => {
      if (!myId || message.userId === myId) return;
      openChatActions({ userId: message.userId, nickname: message.nickname, messageId: message.id });
    },
    [myId, openChatActions],
  );

  return { textOf, onLongPressChat };
}
