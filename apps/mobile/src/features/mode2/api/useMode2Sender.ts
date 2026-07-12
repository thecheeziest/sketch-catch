import type { Stroke } from '@sketch-catch/shared';
import { useRoomStore } from '@/shared/model/room';

export function useMode2Sender() {
  const socket = useRoomStore((s) => s.socket);

  const submitPrompt = (sheetId: string, text: string): void => {
    if (!text.trim()) return;
    socket?.emit('mode2:prompt', { sheetId, text: text.trim() });
  };

  const submitDraw = (sheetId: string, strokes: Stroke[]): void => {
    socket?.emit('mode2:draw:done', { sheetId, strokes });
  };

  const submitAnswer = (sheetId: string, text: string): void => {
    if (!text.trim()) return;
    socket?.emit('mode2:answer', { sheetId, text: text.trim() });
  };

  const judgeFinal = (sheetId: string, ok: boolean): void => {
    socket?.emit('mode2:judge:final', { sheetId, ok });
  };

  const voteBest = (sheetId: string): void => {
    socket?.emit('mode2:vote:best', { sheetId });
  };

  return { submitPrompt, submitDraw, submitAnswer, judgeFinal, voteBest };
}
