// 방 단위 작업 줄 — 같은 방의 상태 변경(소켓 이벤트·타이머·REST)을 도착 순서대로 하나씩 실행한다.
// Redis의 RoomState를 읽고-고치고-저장하는 사이에 다른 작업이 끼어들어 생기는 경합을 막는다.
// 전제: 서버 1대(인메모리 타이머와 동일). 다중 인스턴스로 확장하면 분산 락으로 교체해야 한다.
// 주의: runInRoom 안에서 같은 방의 runInRoom을 await하면 영원히 대기한다(교착).
const tails = new Map<string, Promise<void>>();

export function runInRoom<T>(code: string, task: () => Promise<T>): Promise<T> {
  const prev = tails.get(code) ?? Promise.resolve();
  const result = prev.then(task);
  // 실패한 작업이 뒤 작업을 막지 않도록 꼬리는 항상 resolve 상태로 둔다
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  tails.set(code, tail);
  void tail.then(() => {
    if (tails.get(code) === tail) tails.delete(code);
  });
  return result;
}

// 여러 방에 걸친 작업(퇴장 등) — 코드 정렬 순서로 줄을 잡아 교차 대기를 피한다
export function runInRooms<T>(codes: string[], task: () => Promise<T>): Promise<T> {
  const sorted = [...new Set(codes)].sort();
  const run = sorted.reduceRight<() => Promise<T>>((inner, code) => () => runInRoom(code, inner), task);
  return run();
}
