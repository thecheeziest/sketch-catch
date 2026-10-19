import { useCallback, useEffect, useRef, useState } from 'react';

export type InviteCooldownStatus = 'idle' | 'coolingDown' | 'resendable';

/**
 * 친구별 초대 재전송 쿨다운. 초대 직후에는 연타를 막고, 쿨다운이 지나면 '다시 초대'를 허용한다
 * (상대가 초대를 놓쳤거나 거절했을 때 다시 보낼 수 있어야 한다).
 */
export function useInviteCooldown(cooldownMs: number) {
  const [statusById, setStatusById] = useState<ReadonlyMap<string, InviteCooldownStatus>>(() => new Map());
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const setStatus = useCallback((userId: string, status: InviteCooldownStatus) => {
    setStatusById(prev => new Map(prev).set(userId, status));
  }, []);

  const markInvited = useCallback(
    (userId: string) => {
      const timers = timersRef.current;
      const existing = timers.get(userId);
      if (existing) clearTimeout(existing);
      setStatus(userId, 'coolingDown');
      timers.set(
        userId,
        setTimeout(() => {
          timers.delete(userId);
          setStatus(userId, 'resendable');
        }, cooldownMs),
      );
    },
    [cooldownMs, setStatus],
  );

  const getStatus = useCallback(
    (userId: string): InviteCooldownStatus => statusById.get(userId) ?? 'idle',
    [statusById],
  );

  return { getStatus, markInvited };
}
