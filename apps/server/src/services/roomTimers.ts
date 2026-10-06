import { logger } from '../lib/logger.js';
import { runInRoom } from './roomQueue.js';

// 방 단위 타이머 레지스트리 — 라운드·다음 라운드·모드2 단계·리뷰·시상식 타이머를 한곳에서 관리한다.
// 같은 key로 다시 걸면 이전 타이머는 취소되고, 게임 종료·방 삭제 시 clearRoomTimers로 일괄 정리한다.
export type RoomTimerKey = 'round' | 'nextRound' | 'mode2Step' | 'review' | 'award';

const timers = new Map<string, Map<RoomTimerKey, ReturnType<typeof setTimeout>>>();

export function setRoomTimer(code: string, key: RoomTimerKey, delayMs: number, task: () => Promise<void>): void {
  clearRoomTimer(code, key);
  const handle = setTimeout(() => {
    const roomTimers = timers.get(code);
    if (roomTimers?.get(key) === handle) roomTimers.delete(key);
    // 타이머 콜백도 소켓 이벤트와 같은 방 작업 줄에서 실행 — 에러가 나도 프로세스를 죽이지 않는다
    runInRoom(code, task).catch(err => logger.error({ err, code, key }, 'room timer task failed'));
  }, delayMs);

  const roomTimers = timers.get(code) ?? new Map<RoomTimerKey, ReturnType<typeof setTimeout>>();
  roomTimers.set(key, handle);
  timers.set(code, roomTimers);
}

export function clearRoomTimer(code: string, key: RoomTimerKey): void {
  const roomTimers = timers.get(code);
  const handle = roomTimers?.get(key);
  if (handle === undefined) return;
  clearTimeout(handle);
  roomTimers!.delete(key);
}

export function clearRoomTimers(code: string): void {
  const roomTimers = timers.get(code);
  if (!roomTimers) return;
  for (const handle of roomTimers.values()) clearTimeout(handle);
  timers.delete(code);
}
