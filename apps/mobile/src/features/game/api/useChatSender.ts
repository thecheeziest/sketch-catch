import { useRoomStore } from '@/shared/model/room';
import { playFeedback } from '@/shared/lib/feedback';

export function useChatSender() {
  const socket = useRoomStore(s => s.socket);

  const sendChat = (text: string): boolean => {
    if (!text.trim() || !socket?.connected) return false;
    socket.emit('chat:send', { text: text.trim() });
    playFeedback('send');
    return true;
  };

  const acceptAnswer = (messageId: string): void => {
    socket?.emit('answer:accept', { messageId });
  };

  const submitCustomPrompt = (text: string): boolean => {
    if (!text.trim() || !socket?.connected) return false;
    socket.emit('game:custom:prompt', { text: text.trim() });
    playFeedback('promptSubmit');
    return true;
  };

  return { sendChat, acceptAnswer, submitCustomPrompt };
}
