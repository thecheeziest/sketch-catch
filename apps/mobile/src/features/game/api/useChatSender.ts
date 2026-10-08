import { useRoomStore } from '@/shared/model/room';

export function useChatSender() {
  const socket = useRoomStore(s => s.socket);

  const sendChat = (text: string): boolean => {
    if (!text.trim() || !socket?.connected) return false;
    socket.emit('chat:send', { text: text.trim() });
    return true;
  };

  const acceptAnswer = (messageId: string): void => {
    socket?.emit('answer:accept', { messageId });
  };

  const submitCustomPrompt = (text: string): boolean => {
    if (!text.trim() || !socket?.connected) return false;
    socket.emit('game:custom:prompt', { text: text.trim() });
    return true;
  };

  return { sendChat, acceptAnswer, submitCustomPrompt };
}
