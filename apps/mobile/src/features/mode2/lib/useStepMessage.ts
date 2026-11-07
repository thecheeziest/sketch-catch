import { useEffect, useState } from 'react';

/**
 * active 동안 intervalMs마다 다음 문구로 넘기고, 마지막 문구에서 멈춘다. active가 꺼지면 처음으로 되돌린다.
 */
export function useStepMessage(messages: readonly string[], intervalMs: number, active: boolean): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return undefined;
    }
    const timer = setInterval(() => {
      setIndex(prev => Math.min(prev + 1, messages.length - 1));
    }, intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, messages.length]);

  return messages[index] ?? '';
}
