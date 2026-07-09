import { useMemo } from 'react';

const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export type CooldownStatus =
  | { canChange: true }
  | { canChange: false; nextChangeAt: Date };

export function computeCooldown(lastChange: string | null, now: Date = new Date()): CooldownStatus {
  if (!lastChange) return { canChange: true };
  const lastDate = new Date(lastChange);
  const diff = now.getTime() - lastDate.getTime();
  if (diff >= COOLDOWN_MS) return { canChange: true };
  return { canChange: false, nextChangeAt: new Date(lastDate.getTime() + COOLDOWN_MS) };
}

// Pitfall 7 회피: 서버가 ISO 응답 → 클라이언트는 로컬 타임존(KST)으로 표시
export function formatKoreanDate(d: Date): string {
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${year}년 ${month}월 ${day}일`;
}

export function useNicknameCooldown(lastChange: string | null): CooldownStatus {
  return useMemo(() => computeCooldown(lastChange), [lastChange]);
}
