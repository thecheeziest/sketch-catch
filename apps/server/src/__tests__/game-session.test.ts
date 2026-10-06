// 배포 테스트에서 발견된 동시성·게임 세션 문제의 재현 테스트 (docs/RELEASE_QA_ISSUES.md A-1~A-5, R1~R9)
// rooms.service는 Redis 대신 JSON 직렬화 Map으로 흉내 내고, 핸들러·작업 줄·타이머 레지스트리는 실제 코드를 사용한다.
import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest';
import type { RoomState, Player, Mode1RoundCurrent } from '@sketch-catch/shared';

const store = vi.hoisted(() => new Map<string, string>());

vi.mock('../services/rooms.service.js', () => ({
  getRoomState: vi.fn(async (code: string) => {
    await Promise.resolve(); // Redis 왕복처럼 비동기 경계를 둔다
    const raw = store.get(code);
    return raw ? (JSON.parse(raw) as RoomState) : null;
  }),
  saveRoomState: vi.fn(async (state: RoomState) => {
    await Promise.resolve();
    store.set(state.code, JSON.stringify(state));
  }),
  withRoomLock: vi.fn((_code: string, fn: () => unknown) => fn()),
}));
vi.mock('../services/word.service.js', () => ({
  pickRoundWord: vi.fn(),
}));
vi.mock('../db/redis.js', () => ({
  redis: {
    del: vi.fn(async (...keys: string[]) => {
      for (const key of keys) store.delete(key.replace(/^room:/, '').replace(/:state$/, ''));
    }),
  },
  setPresence: vi.fn(),
  setUserRoom: vi.fn(),
  clearUserRoom: vi.fn(),
  getUserRoom: vi.fn(async () => 'ABC123'),
}));
vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
        nickname: where.id,
        characterId: 'cat',
        friendCode: 'CODE0',
      })),
    },
  },
}));
vi.mock('../socket/presence.namespace.js', () => ({ broadcastPresenceUpdate: vi.fn() }));
vi.mock('../services/replay.service.js', () => ({ generateSheetGifs: vi.fn() }));

const { pickRoundWord } = await import('../services/word.service.js');
const { runInRoom } = await import('../services/roomQueue.js');
const { handleRoomJoin, handleRoomReady, handleRoomStart, handleRoomLeave } = await import(
  '../socket/handlers/room.js'
);
const { handleChatSend } = await import('../socket/handlers/chat.js');
const { handlePlayerLeft } = await import('../socket/handlers/game.js');
const { handleRematch } = await import('../socket/handlers/award.js');

const CODE = 'ABC123';
const ROOM = `room:${CODE}`;

type Emitted = { room: string; event: string; payload: unknown };

function makeNamespace() {
  const emitted: Emitted[] = [];
  return {
    emitted,
    to: (room: string) => ({ emit: (event: string, payload: unknown) => emitted.push({ room, event, payload }) }),
    in: () => ({ fetchSockets: async () => [], socketsLeave: vi.fn() }),
  };
}

function makeSocket(userId: string, rooms: string[] = [ROOM]) {
  const roomSet = new Set(rooms);
  return {
    id: `${userId}-socket`,
    data: { userId },
    rooms: roomSet,
    emit: vi.fn(),
    join: vi.fn(async (r: string) => void roomSet.add(r)),
    leave: vi.fn((r: string) => void roomSet.delete(r)),
  };
}

function makePlayer(id: string, slot: number, overrides: Partial<Player> = {}): Player {
  return {
    id,
    nickname: id,
    friendCode: 'CODE0',
    characterId: 'cat',
    slot,
    isHost: slot === 0,
    isReady: slot !== 0,
    connected: true,
    ...overrides,
  };
}

function seedLobby(overrides: Partial<RoomState> = {}): void {
  const state: RoomState = {
    code: CODE,
    hostId: 'u1',
    mode: 1,
    status: 'LOBBY',
    players: [makePlayer('u1', 0), makePlayer('u2', 1), makePlayer('u3', 2)],
    config: { roundCount: 1, drawTimer: 30, answerTimer: 10, categories: ['ANIMAL'], playerCountMax: 6 },
    scoreboard: {},
    current: null,
    allReady: true,
    ...overrides,
  };
  store.set(CODE, JSON.stringify(state));
}

function readState(): RoomState {
  return JSON.parse(store.get(CODE)!) as RoomState;
}

const eventsOf = (ns: ReturnType<typeof makeNamespace>, event: string) =>
  ns.emitted.filter(e => e.event === event).map(e => e.payload);

// 방장(u1)이 게임을 시작해 u1이 출제하는 첫 라운드까지 진행
async function startGame(ns: ReturnType<typeof makeNamespace>) {
  await runInRoom(CODE, () => handleRoomStart(ns as never, makeSocket('u1') as never));
}

describe('게임 세션·동시성', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(pickRoundWord).mockResolvedValue({ word: '사과', category: 'ANIMAL' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('A-2: 두 명이 동시에 정답을 보내도 라운드는 한 번만 끝나고 점수도 한 명만 받는다', async () => {
    seedLobby({ config: { roundCount: 2, drawTimer: 30, answerTimer: 10, categories: ['ANIMAL'], playerCountMax: 6 } });
    const ns = makeNamespace();
    await startGame(ns);

    await Promise.all([
      runInRoom(CODE, () => handleChatSend(ns as never, makeSocket('u2') as never, { text: '사과' })),
      runInRoom(CODE, () => handleChatSend(ns as never, makeSocket('u3') as never, { text: '사과' })),
    ]);

    expect(eventsOf(ns, 'game:round:end')).toHaveLength(1);
    const scoreboard = readState().scoreboard;
    expect(Object.keys(scoreboard).filter(id => id !== 'u1')).toEqual(['u2']);

    // 다음 라운드도 한 번만 시작된다
    await vi.advanceTimersByTimeAsync(3000);
    const roundStarts = eventsOf(ns, 'game:round:start') as Array<{ roundIndex: number }>;
    expect(roundStarts.filter(r => r.roundIndex === 1)).toHaveLength(1);
  });

  it('A-1: 게임이 시작된 방에 새 유저가 들어오면 거부된다', async () => {
    seedLobby();
    const ns = makeNamespace();
    await startGame(ns);

    const newcomer = makeSocket('u9', []);
    await runInRoom(CODE, () => handleRoomJoin(ns as never, newcomer as never, CODE));

    expect(newcomer.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'GAME_IN_PROGRESS' }));
    expect(readState().players.map(p => p.id)).not.toContain('u9');
  });

  it('A-1: 진행 중 라운드에 재접속하면 현재 라운드를 남은 시간과 함께 다시 받는다 (제시어는 출제자만)', async () => {
    seedLobby();
    const ns = makeNamespace();
    await startGame(ns);
    await vi.advanceTimersByTimeAsync(10_000);

    const guesser = makeSocket('u2');
    await runInRoom(CODE, () => handleRoomJoin(ns as never, guesser as never, CODE));
    const drawer = makeSocket('u1');
    await runInRoom(CODE, () => handleRoomJoin(ns as never, drawer as never, CODE));

    const guesserRound = guesser.emit.mock.calls.find(c => c[0] === 'game:round:start')?.[1];
    expect(guesserRound).toMatchObject({ roundIndex: 0, drawerId: 'u1', durationSec: 20 });
    expect(guesserRound).not.toHaveProperty('promptForDrawer');
    const drawerRound = drawer.emit.mock.calls.find(c => c[0] === 'game:round:start')?.[1];
    expect(drawerRound).toMatchObject({ promptForDrawer: '사과' });
  });

  it('A-5: 미준비 유저가 들어온 뒤에는 방장이 시작할 수 없다', async () => {
    seedLobby();
    const ns = makeNamespace();
    await runInRoom(CODE, () => handleRoomJoin(ns as never, makeSocket('u4', []) as never, CODE));
    expect(readState().allReady).toBe(false);

    const host = makeSocket('u1');
    await runInRoom(CODE, () => handleRoomStart(ns as never, host as never));

    expect(host.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'NOT_ALL_READY' }));
    expect(readState().status).toBe('LOBBY');
  });

  it('A-4: 대기실이 아닌 상태에서는 다시 시작할 수 없다', async () => {
    seedLobby();
    const ns = makeNamespace();
    await startGame(ns);
    const gameIdBefore = readState().gameId;

    const host = makeSocket('u1');
    await runInRoom(CODE, () => handleRoomStart(ns as never, host as never));

    expect(host.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'GAME_IN_PROGRESS' }));
    expect(readState().gameId).toBe(gameIdBefore);
  });

  it('A-3/A-4: 다음 라운드 대기 중 게임이 끝나면 예약됐던 라운드가 게임을 되살리지 않는다', async () => {
    seedLobby({
      players: [makePlayer('u1', 0), makePlayer('u2', 1), makePlayer('u3', 2)],
      config: { roundCount: 2, drawTimer: 30, answerTimer: 10, categories: ['ANIMAL'], playerCountMax: 6 },
    });
    const ns = makeNamespace();
    await startGame(ns);
    await runInRoom(CODE, () => handleChatSend(ns as never, makeSocket('u2') as never, { text: '사과' }));

    // 다음 라운드 예약(3초) 사이에 인원 부족으로 강제 종료
    await runInRoom(CODE, () => handlePlayerLeft(ns as never, CODE, 'u3'));
    expect(readState().status).toBe('AWARD');

    await vi.advanceTimersByTimeAsync(3000);
    expect(readState().status).toBe('AWARD');
    const roundStarts = eventsOf(ns, 'game:round:start') as Array<{ roundIndex: number }>;
    expect(roundStarts.some(r => r.roundIndex === 1)).toBe(false);
  });

  it('R1/R8: 라운드 정보가 비어 있는 방에서 채팅해도 예외가 나지 않는다', async () => {
    seedLobby({ status: 'MODE1_ROUND_START', current: null, gameId: 'g1' });
    const ns = makeNamespace();

    await expect(
      runInRoom(CODE, () => handleChatSend(ns as never, makeSocket('u2') as never, { text: '안녕' })),
    ).resolves.toBeUndefined();
    expect(eventsOf(ns, 'chat:message')).toHaveLength(0);
  });

  it('R9: 제시어를 구할 수 없으면 게임을 취소하고 대기실로 되돌린다', async () => {
    vi.mocked(pickRoundWord).mockResolvedValue(null);
    seedLobby();
    const ns = makeNamespace();
    await startGame(ns);

    const state = readState();
    expect(state.status).toBe('LOBBY');
    expect(state.gameId).toBeUndefined();
    expect(state.current).toBeNull();
    expect(ns.emitted).toContainEqual(
      expect.objectContaining({ room: ROOM, event: 'error', payload: expect.objectContaining({ code: 'WORD_POOL_EMPTY' }) }),
    );
  });

  it('R2: 상태가 같은 gameId인 이벤트만 반영되고 라운드 종료는 현재 라운드에만 적용된다', async () => {
    seedLobby();
    const ns = makeNamespace();
    await startGame(ns);
    const { gameId } = readState();
    const roundStart = eventsOf(ns, 'game:round:start')[0] as { gameId: string };
    expect(roundStart.gameId).toBe(gameId);
    expect((readState().current as Mode1RoundCurrent).roundIndex).toBe(0);
  });
});

describe('시상식 → 대기실 복귀', () => {
  beforeEach(async () => {
    store.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(pickRoundWord).mockResolvedValue({ word: '사과', category: 'ANIMAL' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1라운드(= 3명이 한 번씩 출제하는 3턴) 게임을 매 턴 정답으로 끝내 시상식 진입
  async function reachAward(ns: ReturnType<typeof makeNamespace>) {
    seedLobby();
    await startGame(ns);
    for (let turn = 0; turn < 3; turn++) {
      const { drawerId } = readState().current as Mode1RoundCurrent;
      const guesser = drawerId === 'u2' ? 'u3' : 'u2';
      await runInRoom(CODE, () => handleChatSend(ns as never, makeSocket(guesser) as never, { text: '사과' }));
      if (turn < 2) await vi.advanceTimersByTimeAsync(3000);
    }
    const state = readState();
    expect(state.status).toBe('AWARD');
    return state;
  }

  it('시상식에 들어가면 전원 inAward=true, 준비 상태는 초기화된다', async () => {
    const ns = makeNamespace();
    const state = await reachAward(ns);
    expect(state.players.every(p => p.inAward === true && p.isReady === false)).toBe(true);
    expect(state.awardEndsAt).toBeTypeOf('number');
  });

  it('[한번 더!]를 누른 유저만 남고, 10초 만료 시 누르지 않은 유저는 제거된 뒤 대기실로 전환된다', async () => {
    const ns = makeNamespace();
    await reachAward(ns);

    await runInRoom(CODE, () => handleRematch(ns as never, makeSocket('u2')));
    expect(readState().status).toBe('AWARD');
    expect(readState().players.find(p => p.id === 'u2')?.inAward).toBe(false);

    await vi.advanceTimersByTimeAsync(10_000);

    const state = readState();
    expect(state.status).toBe('LOBBY');
    expect(state.players.map(p => p.id)).toEqual(['u2']);
    // 방장(u1)이 제거됐으므로 u2가 승계
    expect(state.hostId).toBe('u2');
    expect(state.gameId).toBeUndefined();
    expect(state.scoreboard).toEqual({});
  });

  it('전원이 [한번 더!]를 누르면 만료를 기다리지 않고 바로 대기실로 전환된다', async () => {
    const ns = makeNamespace();
    await reachAward(ns);

    for (const id of ['u1', 'u2', 'u3']) {
      await runInRoom(CODE, () => handleRematch(ns as never, makeSocket(id)));
    }

    const state = readState();
    expect(state.status).toBe('LOBBY');
    expect(state.players).toHaveLength(3);
    expect(state.players.every(p => !p.isReady && p.inAward === undefined)).toBe(true);
  });

  it('남은 유저가 모두 [나가기]하면 방이 삭제된다', async () => {
    const ns = makeNamespace();
    await reachAward(ns);

    for (const id of ['u1', 'u2', 'u3']) {
      await runInRoom(CODE, () => handleRoomLeave(ns as never, makeSocket(id) as never));
    }

    expect(store.has(CODE)).toBe(false);
    // 삭제된 방의 시상식 타이머가 나중에 실행돼도 방이 되살아나지 않는다
    await vi.advanceTimersByTimeAsync(10_000);
    expect(store.has(CODE)).toBe(false);
  });

  it('복귀한 대기실에서 다시 게임을 시작하면 새 gameId가 발급된다', async () => {
    const ns = makeNamespace();
    const awardState = await reachAward(ns);
    const firstGameId = awardState.gameId;

    for (const id of ['u1', 'u2', 'u3']) {
      await runInRoom(CODE, () => handleRematch(ns as never, makeSocket(id)));
    }
    for (const id of ['u2', 'u3']) {
      await runInRoom(CODE, () => handleRoomReady(ns as never, makeSocket(id) as never, true));
    }
    await startGame(ns);

    const state = readState();
    expect(state.status).toBe('MODE1_ROUND_START');
    expect(state.gameId).toBeTypeOf('string');
    expect(state.gameId).not.toBe(firstGameId);
  });
});

describe('방 작업 줄', () => {
  it('앞 작업이 실패해도 다음 작업은 실행된다', async () => {
    const order: string[] = [];
    const failing = runInRoom('Q1', async () => {
      order.push('first');
      throw new Error('boom');
    });
    const next = runInRoom('Q1', async () => {
      order.push('second');
    });

    await expect(failing).rejects.toThrow('boom');
    await next;
    expect(order).toEqual(['first', 'second']);
  });

  it('같은 방 작업은 도착 순서대로 하나씩 실행된다', async () => {
    const order: string[] = [];
    const slow = runInRoom('Q2', async () => {
      await new Promise(r => setTimeout(r, 10));
      order.push('slow');
    });
    const fast = runInRoom('Q2', async () => {
      order.push('fast');
    });
    await Promise.all([slow, fast]);
    expect(order).toEqual(['slow', 'fast']);
  });
});
