import type { Namespace } from 'socket.io';
import type { ClientEvents, Mode1RoundCurrent, Mode2Step, RoomState, ServerEvents } from '@sketch-catch/shared';
import { getRoomState } from '../../services/rooms.service.js';
import { setRoomTimer, type RoomTimerKey } from '../../services/roomTimers.js';
import { hasRoundDrawing, strokeRoundKey } from '../../services/strokeStore.js';
import { makeReviewDrawing, REVIEW_WORDS } from '../../services/reviewDrawings.js';
import { handleChatSend } from './chat.js';
import { handleStrokeAppend, handleStrokeEnd, handleStrokeStart } from './stroke.js';
import { handleMode2Answer, handleMode2DrawDone, handleMode2Prompt, type Mode2Current } from './mode2.js';

type GameNamespace = Namespace<ClientEvents, ServerEvents>;

function botActor(game: GameNamespace, code: string, userId: string) {
  return { data: { userId }, rooms: new Set([`room:${code}`]), to: game.to.bind(game), emit: () => true };
}

export function scheduleReviewRound(game: GameNamespace, state: RoomState): void {
  if (!state.reviewOwnerId) return;
  const current = state.current as Mode1RoundCurrent;
  const { gameId, code } = state;

  const tick = async (strokeIndex: number): Promise<void> => {
    const latest = await getRoomState(code);
    if (!latest?.reviewOwnerId || latest.gameId !== gameId || latest.status !== 'MODE1_ROUND_START') return;
    const round = latest.current as Mode1RoundCurrent;
    if (round.roundIndex !== current.roundIndex) return;
    if (!latest.players.some(p => p.id === latest.reviewOwnerId && !p.left)) return;

    const drawer = latest.players.find(p => p.id === round.drawerId);
    const elapsed = Date.now() - round.startedAt;
    let nextStroke = strokeIndex;
    if (drawer?.isBot) {
      const stroke = makeReviewDrawing(drawer.id, round.prompt)[strokeIndex];
      if (stroke) {
        const actor = botActor(game, code, drawer.id);
        await handleStrokeStart(game, actor, { strokeId: stroke.id, color: stroke.color, width: stroke.width });
        await handleStrokeAppend(game, actor, { strokeId: stroke.id, points: stroke.points });
        await handleStrokeEnd(game, actor, { strokeId: stroke.id });
        nextStroke++;
      }
    }

    const guessAfter = drawer?.isBot ? 30_000 : 12_000;
    if (elapsed >= guessAfter && hasRoundDrawing(code, strokeRoundKey(gameId, round.roundIndex))) {
      const guesser = latest.players.find(p => p.isBot && p.id !== round.drawerId);
      if (guesser) {
        await handleChatSend(game, botActor(game, code, guesser.id), { text: round.prompt });
        return;
      }
    }
    setRoomTimer(code, 'reviewBot', 500, () => tick(nextStroke));
  };
  setRoomTimer(code, 'reviewBot', 1200, () => tick(0));
}

export function scheduleReviewSteps(game: GameNamespace, state: RoomState, payloads: Mode2Step[]): void {
  if (!state.reviewOwnerId) return;
  const bots = state.players.filter(p => p.isBot);
  for (const [index, bot] of bots.entries()) {
    const payload = payloads.find(step => step.assigneeId === bot.id && !step.submitted);
    if (!payload) continue;
    const key: RoomTimerKey = index === 0 ? 'reviewBot1' : 'reviewBot2';
    setRoomTimer(state.code, key, (payload.cueMs ?? 0) + 2500 + index * 1000, async () => {
      const latest = await getRoomState(state.code);
      if (!latest?.reviewOwnerId || latest.gameId !== state.gameId || latest.status !== state.status) return;
      const current = latest.current as Mode2Current;
      if (current.step !== payload.stepIndex || current.submitted.includes(payload.sheetId)) return;
      if (!latest.players.some(p => p.id === latest.reviewOwnerId && !p.left)) return;
      const actor = botActor(game, state.code, bot.id);
      const word = REVIEW_WORDS[index % REVIEW_WORDS.length]!;
      if (payload.phase === 'PROMPT') {
        await handleMode2Prompt(game, actor, { sheetId: payload.sheetId, text: word });
      } else if (payload.phase === 'DRAW') {
        const text = payload.previousContent?.kind === 'TEXT' ? payload.previousContent.text : word;
        await handleMode2DrawDone(game, actor, { sheetId: payload.sheetId, strokes: makeReviewDrawing(bot.id, text) });
      } else {
        await handleMode2Answer(game, actor, { sheetId: payload.sheetId, text: word });
      }
    });
  }
}
