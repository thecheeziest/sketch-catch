import { useEffect, useRef } from 'react';
import { playFeedback } from './feedback';

// 0초 종료음은 서버 판정에서만 처리한다. 복귀 때 지나간 틱을 몰아서 재생하지 않는다.
export function useTimerFeedback(timeLeft: number, key: string, enabled = true): void {
  const previous = useRef({ key, timeLeft });
  useEffect(() => {
    const old = previous.current;
    previous.current = { key, timeLeft };
    if (!enabled || timeLeft <= 0 || timeLeft > 10) return;
    if (old.key === key && timeLeft === old.timeLeft) return;
    playFeedback('tick', { key: `${key}:tick:${timeLeft}` });
  }, [timeLeft, key, enabled]);
}
