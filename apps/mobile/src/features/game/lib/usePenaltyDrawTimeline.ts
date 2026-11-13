import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { playFeedback, setMusicDucked, setMusicMuted } from '@/shared/lib/feedback';
import {
  buildPenaltyDrawTimeline,
  PENALTY_DRAW_DONE_FRAME,
  type PenaltyDrawFrame,
} from '@/features/game/lib/penaltyDrawTimeline';

// 화면이 열릴 때마다 추첨 연출을 처음부터 재생한다. 모션 줄이기 설정이면 바로 결과로 넘어간다.
export function usePenaltyDrawTimeline(candidateCount: number): PenaltyDrawFrame {
  const [frame, setFrame] = useState<PenaltyDrawFrame>({ phase: 'intro', spot: -1 });

  useEffect(() => {
    let disposed = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const stopSounds: Array<() => void> = [];

    const play = () => {
      setMusicDucked(true);
      for (const event of buildPenaltyDrawTimeline(candidateCount)) {
        timers.push(
          setTimeout(() => {
            setFrame(event.frame);
            if (event.sound) stopSounds.push(playFeedback(event.sound));
            // 최종 발표 동안은 BGM 무음, 조명이 다시 켜지면 복귀
            if (event.frame.phase === 'reveal') setMusicMuted(true);
            if (event.frame.phase === 'promote') setMusicMuted(false);
            if (event.frame.phase === 'done') setMusicDucked(false);
          }, event.at),
        );
      }
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(reduceMotion => {
        if (disposed) return;
        if (reduceMotion) setFrame(PENALTY_DRAW_DONE_FRAME);
        else play();
      });

    return () => {
      disposed = true;
      timers.forEach(clearTimeout);
      stopSounds.forEach(stop => stop());
      setMusicMuted(false);
      setMusicDucked(false);
    };
  }, [candidateCount]);

  return frame;
}
