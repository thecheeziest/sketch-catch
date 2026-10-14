import type { Stroke } from '@sketch-catch/shared';
import { useRoomStore } from '@/shared/model/room';
import { playFeedback } from '@/shared/lib/feedback';

export function useMode2Sender() {
  const socket = useRoomStore(s => s.socket);

  const submitPrompt = (sheetId: string, text: string): boolean => {
    if (!text.trim() || !socket?.connected) return false;
    socket.emit('mode2:prompt', { sheetId, text: text.trim() });
    playFeedback('submit');
    return true;
  };

  const submitDraw = (sheetId: string, strokes: Stroke[]): boolean => {
    if (!socket?.connected) return false;
    socket.emit('mode2:draw:done', { sheetId, strokes });
    playFeedback('submit');
    return true;
  };

  const submitAnswer = (sheetId: string, text: string): boolean => {
    if (!text.trim() || !socket?.connected) return false;
    socket.emit('mode2:answer', { sheetId, text: text.trim() });
    playFeedback('submit');
    return true;
  };

  const judgeFinal = (sheetId: string, ok: boolean): boolean => {
    if (!socket?.connected) return false;
    socket.emit('mode2:judge:final', { sheetId, ok });
    playFeedback(ok ? 'judgeOk' : 'judgeNg');
    return true;
  };

  const voteBest = (sheetId: string): boolean => {
    if (!socket?.connected) return false;
    socket.emit('mode2:vote:best', { sheetId });
    playFeedback('vote');
    return true;
  };

  return { submitPrompt, submitDraw, submitAnswer, judgeFinal, voteBest };
}
