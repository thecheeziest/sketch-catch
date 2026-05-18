import { describe, it, vi } from 'vitest';

// Wave 0 스캐폴드: LBBY-01 / LBBY-02 / LBBY-03 커버
// 구현 모듈은 04-04에서 생성 → 그 때 import 활성화 + 실제 assertion 작성
// import { handleRoomJoin, handleRoomReady, handleRoomStart, handleRoomLeave } from '../socket/room.handler.js';

vi.mock('../db/redis.js', () => ({
  redis: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
  setPresence: vi.fn(),
  getPresence: vi.fn(),
}));

// socket mock
const _mockSocket = {
  emit: vi.fn(),
  join: vi.fn(),
  leave: vi.fn(),
  rooms: new Set(['room:ABC123']),
  data: { userId: 'u1' },
};

// namespace mock
const _mockNamespace = {
  to: vi.fn(() => ({ emit: vi.fn() })),
  emit: vi.fn(),
};

describe('socket room handlers', () => {
  // LBBY-01: handleRoomJoin
  it.todo('LBBY-01: handleRoomJoin이 슬롯을 채우고 room:state를 broadcast한다');

  // LBBY-02: handleRoomReady / handleRoomStart
  it.todo('LBBY-02: handleRoomReady가 isReady 토글 후 allReady를 서버에서 계산');
  it.todo('LBBY-02: handleRoomStart가 비방장 요청을 거부한다');

  // LBBY-03: handleRoomLeave
  it.todo('LBBY-03: handleRoomLeave에서 방장 퇴장 시 slot 최소 참가자가 hostId 승계');
});
