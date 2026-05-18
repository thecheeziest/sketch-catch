import { describe, it, vi } from 'vitest';

// Wave 0 스캐폴드: ROOM-01 / ROOM-02 커버
// 구현 모듈은 04-02에서 생성 → 그 때 import 활성화 + 실제 assertion 작성
// import { createRoom, getRoomState } from '../services/rooms.service.js';

vi.mock('../db/redis.js', () => ({
  redis: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
  setPresence: vi.fn(),
  getPresence: vi.fn(),
}));

describe('rooms.service', () => {
  // ROOM-01: createRoom
  it.todo('ROOM-01: createRoom이 6자리 영문대문자/숫자 코드를 발급한다');
  it.todo('ROOM-01: createRoom이 title/locked/config를 RoomState에 반영한다');

  // ROOM-02: getRoomState
  it.todo('ROOM-02: getRoomState가 존재하지 않는 코드에 null 반환');
  it.todo('ROOM-02: getRoomState가 저장된 RoomState를 파싱해 반환');
});
