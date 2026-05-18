import { describe, it, vi } from 'vitest';

// Wave 0 스캐폴드: ROOM-03 / ROOM-04 커버
// 구현 모듈은 04-03에서 생성 → 그 때 import 활성화 + 실제 assertion 작성
// import { enqueueMatch, dequeueMatch } from '../services/match.service.js';

vi.mock('../db/redis.js', () => ({
  redis: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    zadd: vi.fn(),
    zcount: vi.fn(),
    zpopmin: vi.fn(),
    zrem: vi.fn(),
  },
  setPresence: vi.fn(),
  getPresence: vi.fn(),
}));

describe('match.service', () => {
  // ROOM-03: enqueueMatch
  it.todo('ROOM-03: enqueueMatch가 matchqueue:1:{count} ZSET에 userId를 ZADD한다');
  it.todo('ROOM-03: 인원 충족 시 ZPOPMIN으로 정확히 playerCount명 pop 후 방 생성');
  it.todo('ROOM-03: pop 결과가 playerCount 미만이면 다시 ZADD (레이스 컨디션 방어 — Pitfall 7)');

  // ROOM-04: dequeueMatch
  it.todo('ROOM-04: dequeueMatch가 6/8/10 큐 전부에서 ZREM한다');
});
