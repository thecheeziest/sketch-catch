import type { Stroke } from '@sketch-catch/shared';
import { useRoomStore } from '@/shared/model/room';
import { playFeedback } from '@/shared/lib/feedback';

export type Mode2Draft = { text: string } | { strokes: Stroke[] };

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

  // 작성 중인 내용 — 시간 초과 시 서버가 이 값으로 자동 제출한다 (효과음 없음)
  const syncDraft = (sheetId: string, draft: Mode2Draft): void => {
    if (!socket?.connected) return;
    socket.emit('mode2:draft', { sheetId, ...draft });
  };

  return { submitPrompt, submitDraw, submitAnswer, syncDraft };
}
