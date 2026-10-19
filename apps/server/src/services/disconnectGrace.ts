import { OFFLINE_GRACE_SEC } from '@sketch-catch/shared';
import { logger } from '../lib/logger.js';
import { runInRoom } from './roomQueue.js';

// 게임 중 연결이 끊긴 유저의 자리 유지 타이머 — 앱이 잠깐 백그라운드로 가서 소켓이 끊겨도 바로 퇴장시키지 않고,
// 유예 시간 안에 다시 들어오면 그대로 이어서 한다. 유예가 끝나면 task(퇴장 처리)를 방 작업 줄에서 실행한다.
const GRACE_MS = OFFLINE_GRACE_SEC * 1000;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const keyOf = (code: string, userId: string): string => `${code}:${userId}`;

export function scheduleGraceLeave(code: string, userId: string, task: () => Promise<void>): void {
  cancelGraceLeave(code, userId);
  const key = keyOf(code, userId);
  const handle = setTimeout(() => {
    if (timers.get(key) === handle) timers.delete(key);
    runInRoom(code, task).catch(err => logger.error({ err, code, userId }, 'grace leave task failed'));
  }, GRACE_MS);
  timers.set(key, handle);
}

export function cancelGraceLeave(code: string, userId: string): void {
  const key = keyOf(code, userId);
  const handle = timers.get(key);
  if (handle === undefined) return;
  clearTimeout(handle);
  timers.delete(key);
}
