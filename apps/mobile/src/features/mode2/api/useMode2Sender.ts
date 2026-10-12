import type { Stroke } from '@sketch-catch/shared';
import { useRoomStore } from '@/shared/model/room';

export function useMode2Sender() {
  const socket = useRoomStore(s => s.socket);

  const submitPrompt = (sheetId: string, text: string): boolean => {
    if (!text.trim() || !socket?.connected) return false;
    socket.emit('mode2:prompt', { sheetId, text: text.trim() });
    return true;
  };

  const submitDraw = (sheetId: string, strokes: Stroke[]): boolean => {
    if (!socket?.connected) return false;
    socket.emit('mode2:draw:done', { sheetId, strokes });
    return true;
  };

  const submitAnswer = (sheetId: string, text: string): boolean => {
    if (!text.trim() || !socket?.connected) return false;
    socket.emit('mode2:answer', { sheetId, text: text.trim() });
    return true;
  };

  const judgeFinal = (sheetId: string, ok: boolean): boolean => {
    if (!socket?.connected) return false;
    socket.emit('mode2:judge:final', { sheetId, ok });
    return true;
  };

  const voteBest = (sheetId: string): boolean => {
    if (!socket?.connected) return false;
    socket.emit('mode2:vote:best', { sheetId });
    return true;
  };

  return { submitPrompt, submitDraw, submitAnswer, judgeFinal, voteBest };
}
