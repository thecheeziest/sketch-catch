import { useEffect } from 'react';
import { useGameStore } from '@/features/game/model/useGameStore';
import { useMode2Store } from '@/features/mode2/model/useMode2Store';
import { useAuthStore } from '@/shared/model/auth';
import { useRoomStore } from '@/shared/model/room';
import { useToastStore } from '@/shared/model/toast';
import { playFeedback } from '@/shared/lib/feedback';

// 루트에서 구독해 화면 전환 중 첫 이벤트도 받는다. 중복 판정은 이벤트 식별자로 막는다.
export function useGameFeedback(): void {
  useEffect(() => {
    const offGame = useGameStore.subscribe((state, previous) => {
      const myId = useAuthStore.getState().user?.id;
      if (!myId || !state.gameId) return;
      if (state.round && state.round !== previous.round) {
        const identity = `${state.gameId}:${state.round.roundIndex}`;
        const isNew = state.gameId !== previous.gameId || state.round.roundIndex !== previous.round?.roundIndex;
        if (isNew) {
          let event: 'promptRequest' | 'drawer' | 'roundStart' | 'gameStart' = 'roundStart';
          if (state.round.roundIndex === 0 && !state.waitingForPrompt) event = 'gameStart';
          if (state.round.drawerId === myId) event = 'drawer';
          if (state.needsCustomPrompt) event = 'promptRequest';
          playFeedback(event, { key: `${identity}:start`, haptics: !state.needsCustomPrompt });
        } else if (previous.waitingForPrompt && !state.waitingForPrompt) {
          playFeedback('roundStart', { key: `${identity}:drawing` });
        }
      }
      if (
        state.roundResult &&
        state.roundResult !== previous.roundResult &&
        state.roundResult.gameId === state.gameId
      ) {
        const result = state.roundResult;
        let event: 'correct' | 'otherCorrect' | 'drawerCorrect' | 'gameover' = 'otherCorrect';
        if (result.correctUserId === null) event = 'gameover';
        else if (result.correctUserId === myId) event = 'correct';
        else if (state.round?.drawerId === myId) event = 'drawerCorrect';
        playFeedback(event, { key: `${state.gameId}:${result.roundIndex}:result` });
      }
      if (state.wrongAnswer && state.wrongAnswer !== previous.wrongAnswer && state.round && !state.roundResult) {
        playFeedback('wrong', { key: `${state.gameId}:${state.wrongAnswer.messageId}:wrong` });
      }
    });
    const offMode2 = useMode2Store.subscribe((state, previous) => {
      const myId = useAuthStore.getState().user?.id;
      if (!myId || !state.gameId) return;
      if (state.step && state.step !== previous.step && state.step.assigneeId === myId) {
        playFeedback('stepStart', { key: `${state.gameId}:${state.step.stepIndex}:step` });
      }
      const review = state.review;
      if (!review || review === previous.review) return;
      // 정답 공개식: 발표가 넘어갈 때마다 효과음, 실시간 발표가 모두 끝나면 팡파르
      if (review.live) {
        const key = `${state.gameId}:${review.live.sheetIndex}:${review.live.entryIndex}:frame`;
        playFeedback('frame', { key });
      } else if (previous.review?.live) {
        playFeedback('bestReveal', { key: `${state.gameId}:revealEnd` });
      }
    });
    const offRoom = useRoomStore.subscribe((state, previous) => {
      if (state.isMatchmaking && !previous.isMatchmaking) playFeedback('matchStart');
      if (state.matchFoundCode && state.matchFoundCode !== previous.matchFoundCode) playFeedback('matchFound');
      const room = state.roomState;
      const old = previous.roomState;
      if (!room || !old || room === old || room.code !== old.code) return;
      if (room.status === 'LOBBY' && old.status === 'LOBBY') {
        const myId = useAuthStore.getState().user?.id;
        const me = room.players.find(p => p.id === myId);
        const oldMe = old.players.find(p => p.id === myId);
        if (me && oldMe && me.isReady !== oldMe.isReady) playFeedback(me.isReady ? 'ready' : 'unready');
        const joined = room.players.filter(player => !old.players.some(p => p.id === player.id));
        const left = old.players.filter(player => !room.players.some(p => p.id === player.id));
        if (joined.length) playFeedback('playerJoin');
        if (left.length) playFeedback('playerLeave');
      }
      if (room.status === 'AWARD' && old.status !== 'AWARD') {
        playFeedback('awardEnter', { key: `${room.code}:${room.gameId ?? room.startedAt}:award` });
      }
    });
    const offToast = useToastStore.subscribe((state, previous) => {
      for (const toast of state.toasts) {
        if (previous.toasts.some(old => old.id === toast.id)) continue;
        let event: 'warning' | 'confirm' | 'notify' = 'notify';
        if (toast.kind === 'error') event = 'warning';
        if (toast.kind === 'success') event = 'confirm';
        playFeedback(event, { key: `toast:${toast.id}` });
      }
    });
    return () => {
      offGame();
      offMode2();
      offRoom();
      offToast();
    };
  }, []);
}
