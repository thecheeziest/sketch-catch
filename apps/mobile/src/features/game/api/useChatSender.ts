import { useRoomStore } from '@/shared/model/room';

export function useChatSender() {
  const socket = useRoomStore((s) => s.socket);

  const sendChat = (text: string): void => {
    if (!text.trim()) return;
    socket?.emit('chat:send', { text: text.trim() });
  };

  const acceptAnswer = (messageId: string): void => {
    socket?.emit('answer:accept', { messageId });
  };

  const submitCustomPrompt = (text: string): void => {
    if (!text.trim()) return;
    socket?.emit('game:custom:prompt', { text: text.trim() });
  };

  return { sendChat, acceptAnswer, submitCustomPrompt };
}
