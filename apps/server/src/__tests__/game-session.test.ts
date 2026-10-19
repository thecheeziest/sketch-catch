// 배포 테스트에서 발견된 동시성·게임 세션 문제의 재현 테스트 (docs/RELEASE_QA_ISSUES.md A-1~A-5, R1~R9)
// rooms.service는 Redis 대신 JSON 직렬화 Map으로 흉내 내고, 핸들러·작업 줄·타이머 레지스트리는 실제 코드를 사용한다.
import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest';
import type { RoomState, Player, Mode1RoundCurrent, Mode2ReviewState } from '@sketch-catch/shared';

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
  removeRoomFromIndex: vi.fn(),
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
vi.mock('../services/replay.service.js', () => ({ generateSheetGifs: vi.fn().mockResolvedValue(undefined) }));

const { pickRoundWord } = await import('../services/word.service.js');
const { runInRoom } = await import('../services/roomQueue.js');
const { handleRoomJoin, handleRoomReady, handleRoomStart, handleRoomLeave, handleRoomNudge } =
  await import('../socket/handlers/room.js');
const { handleChatSend } = await import('../socket/handlers/chat.js');
const { handleCustomPromptSubmit, handlePlayerLeft, startRound } = await import('../socket/handlers/game.js');
const { startMode2, handleMode2Prompt, handleMode2DrawDone, handleMode2Answer, currentAssignee, sortedPlayers } =
  await import('../socket/handlers/mode2.js');
const { clearRoomTimers } = await import('../services/roomTimers.js');
const { handleRematch } = await import('../socket/handlers/award.js');
const { handleStrokeFill, handleStrokeStart, handleStrokeAppend } = await import('../socket/handlers/stroke.js');

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
  ns.emitted
    .filter(e => e.event === event && (event !== 'game:round:start' || e.room === ROOM || e.room === 'user:u1'))
    .map(e => e.payload);

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
    await vi.advanceTimersByTimeAsync(5000);
    const roundStarts = eventsOf(ns, 'game:round:start') as Array<{ roundIndex: number }>;
    expect(roundStarts.filter(r => r.roundIndex === 1)).toHaveLength(1);
  });

  it.each(['correct', 'timeout'] as const)(
    '마지막 라운드 %s 결과가 5초 유지된 후 시상식으로 이동한다',
    async outcome => {
      seedLobby();
      const ns = makeNamespace();
      await startGame(ns);
      await runInRoom(CODE, () => startRound(ns as never, CODE, 2));
      if (outcome === 'correct') {
        await runInRoom(CODE, () => handleChatSend(ns as never, makeSocket('u2') as never, { text: '사과' }));
      } else {
        await vi.advanceTimersByTimeAsync(30_000);
      }
      expect(readState().status).toBe('MODE1_ROUND_END');
      expect(eventsOf(ns, 'game:round:end')).toHaveLength(1);
      expect(eventsOf(ns, 'game:end')).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(4999);
      expect(readState().status).toBe('MODE1_ROUND_END');
      await vi.advanceTimersByTimeAsync(1);
      expect(readState().status).toBe('AWARD');
      expect(eventsOf(ns, 'game:end')).toHaveLength(1);
    },
  );

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

    await vi.advanceTimersByTimeAsync(5000);
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
      expect.objectContaining({
        room: ROOM,
        event: 'error',
        payload: expect.objectContaining({ code: 'WORD_POOL_EMPTY' }),
      }),
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
      await vi.advanceTimersByTimeAsync(5000);
    }
    const state = readState();
    expect(state.status).toBe('AWARD');
    return state;
  }

  it('시상식에 들어가면 전원 inAward=true, 준비 상태는 초기화된다', async () => {
    const ns = makeNamespace();
    const state = await reachAward(ns);
    expect(state.players.every(p => p.inAward === true && p.isReady === false)).toBe(true);
    expect(state.awardEndsAt).toBeUndefined();
  });

  it('시상식은 시간이 지나도 유지되고 첫 재참여자는 대기실로 복귀한다', async () => {
    const ns = makeNamespace();
    await reachAward(ns);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(readState().status).toBe('AWARD');
    expect(readState().players.every(p => p.inAward)).toBe(true);

    await runInRoom(CODE, () => handleRematch(ns as never, makeSocket('u2')));
    await vi.advanceTimersByTimeAsync(120_000);
    const state = readState();
    expect(state.status).toBe('LOBBY');
    expect(state.players).toHaveLength(3);
    expect(state.players.find(p => p.id === 'u2')?.inAward).toBe(false);
    expect(state.players.find(p => p.id === 'u1')?.inAward).toBe(true);
    // 방장(u1)이 나가기를 누르지 않았으므로 시상식에 남아 있어도 방장은 그대로다
    expect(state.hostId).toBe('u1');
    expect(state.gameId).toBeUndefined();
  });

  it('방장이 나가기를 누르면 가장 먼저 한번 더를 누른 유저가 방장이 된다', async () => {
    const ns = makeNamespace();
    await reachAward(ns);
    await runInRoom(CODE, () => handleRoomLeave(ns as never, makeSocket('u1') as never));
    expect(readState().players.map(p => p.id)).toEqual(['u2', 'u3']);

    await runInRoom(CODE, () => handleRematch(ns as never, makeSocket('u3')));
    const state = readState();
    expect(state.status).toBe('LOBBY');
    expect(state.hostId).toBe('u3');
    expect(state.players.find(p => p.id === 'u3')?.isHost).toBe(true);
    expect(state.players.find(p => p.id === 'u2')?.inAward).toBe(true);
  });

  it('소켓이 방에서 빠져 있어도 방 코드로 한번 더가 처리되고 방에 다시 연결된다', async () => {
    const ns = makeNamespace();
    await reachAward(ns);
    const detached = makeSocket('u2', []);
    await runInRoom(CODE, () => handleRematch(ns as never, detached, CODE));
    expect(readState().status).toBe('LOBBY');
    expect(detached.join).toHaveBeenCalledWith(`room:${CODE}`);
  });

  it('시상식에 남은 유저의 채팅은 대기실에 복귀한 유저에게 전달되지 않는다', async () => {
    const ns = makeNamespace();
    await reachAward(ns);
    await runInRoom(CODE, () => handleRematch(ns as never, makeSocket('u2')));
    ns.emitted.length = 0;

    await runInRoom(CODE, () => handleChatSend(ns as never, makeSocket('u1') as never, { text: '시상식 대화' }));
    const awardRooms = ns.emitted.filter(e => e.event === 'chat:message').map(e => e.room);
    expect(awardRooms.sort()).toEqual(['user:u1', 'user:u3']);
    expect(ns.emitted.find(e => e.event === 'chat:message')?.payload).toMatchObject({ channel: 'AWARD' });

    ns.emitted.length = 0;
    await runInRoom(CODE, () => handleChatSend(ns as never, makeSocket('u2') as never, { text: '대기실 대화' }));
    const lobbyRooms = ns.emitted.filter(e => e.event === 'chat:message').map(e => e.room);
    expect(lobbyRooms).toEqual(['user:u2']);
    expect(ns.emitted.find(e => e.event === 'chat:message')?.payload).toMatchObject({ channel: 'LOBBY' });
  });

  it('시상식 관람자는 새 게임 참가 순서에서 제외되고 뒤늦은 재참여는 거부된다', async () => {
    const ns = makeNamespace();
    await reachAward(ns);
    // 방장(u1)이 먼저 대기실로 복귀하고 u2는 시상식에 남는다
    await handleRematch(ns as never, makeSocket('u1'));
    await handleRoomJoin(ns as never, makeSocket('u4', []) as never, CODE);
    await handleRoomJoin(ns as never, makeSocket('u5', []) as never, CODE);
    await handleRoomReady(ns as never, makeSocket('u4') as never, true);
    await handleRoomReady(ns as never, makeSocket('u5') as never, true);
    await handleRoomStart(ns as never, makeSocket('u1') as never);
    expect(readState().players.map(p => p.id)).toEqual(['u1', 'u4', 'u5']);
    expect(readState().turnSchedule).not.toContain('u2');
    await handleChatSend(ns as never, makeSocket('u2') as never, { text: '사과' });
    expect(readState().status).toBe('MODE1_ROUND_START');
    expect(readState().scoreboard['u2']).toBeUndefined();
    const spectator = makeSocket('u2');
    await handleRematch(ns as never, spectator);
    expect(spectator.emit).toHaveBeenCalledWith('error', {
      code: 'GAME_IN_PROGRESS',
      message: '이미 게임이 시작됐어요!',
    });
  });

  it('새 판이 시작된 뒤에도 시상식에 남은 유저끼리 채팅할 수 있다', async () => {
    const ns = makeNamespace();
    await reachAward(ns);
    await handleRematch(ns as never, makeSocket('u1'));
    await handleRoomJoin(ns as never, makeSocket('u4', []) as never, CODE);
    await handleRoomJoin(ns as never, makeSocket('u5', []) as never, CODE);
    await handleRoomReady(ns as never, makeSocket('u4') as never, true);
    await handleRoomReady(ns as never, makeSocket('u5') as never, true);
    await handleRoomStart(ns as never, makeSocket('u1') as never);
    expect(readState().awardViewers?.map(p => p.id)).toEqual(['u2', 'u3']);

    ns.emitted.length = 0;
    await handleChatSend(ns as never, makeSocket('u2') as never, { text: '우리끼리' });
    const rooms = ns.emitted.filter(e => e.event === 'chat:message').map(e => e.room);
    expect(rooms.sort()).toEqual(['user:u2', 'user:u3']);
    expect(readState().status).toBe('MODE1_ROUND_START');

    // 퇴장하면 보관 목록에서 빠진다
    await handleRoomLeave(ns as never, makeSocket('u3') as never);
    expect(readState().awardViewers?.map(p => p.id)).toEqual(['u2']);
  });

  it('재촉하기는 대기실 인원이 시상식에 남은 방장에게만 보낼 수 있고 쿨다운이 있다', async () => {
    const ns = makeNamespace();
    await reachAward(ns);
    await handleRematch(ns as never, makeSocket('u2'));
    ns.emitted.length = 0;

    await handleRoomNudge(ns as never, makeSocket('u1') as never); // 시상식에 있는 사람은 불가
    expect(ns.emitted.filter(e => e.event === 'room:nudged')).toHaveLength(0);

    const nudger = makeSocket('u2');
    await handleRoomNudge(ns as never, nudger as never);
    expect(ns.emitted.filter(e => e.event === 'room:nudged').map(e => e.room)).toEqual(['user:u1']);

    await handleRoomNudge(ns as never, nudger as never);
    expect(ns.emitted.filter(e => e.event === 'room:nudged')).toHaveLength(1);
    expect(nudger.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'NUDGE_COOLDOWN' }));
  });

  it('한 명만 복귀하고 나머지가 퇴장하면 즉시 대기실로 전환된다', async () => {
    const ns = makeNamespace();
    await reachAward(ns);
    await runInRoom(CODE, () => handleRematch(ns as never, makeSocket('u2')));
    for (const id of ['u1', 'u3']) await runInRoom(CODE, () => handleRoomLeave(ns as never, makeSocket(id) as never));
    expect(readState().status).toBe('LOBBY');
    expect(readState().players.map(p => p.id)).toEqual(['u2']);
  });

  it('큐 대기 중 소켓 방 목록이 비워져도 확보한 방 코드로 퇴장 처리한다', async () => {
    const ns = makeNamespace();
    await reachAward(ns);
    await runInRoom(CODE, () => handleRematch(ns as never, makeSocket('u2')));
    const leaving = makeSocket('u1');
    const task = runInRoom(CODE, () => handleRoomLeave(ns as never, leaving as never, [CODE]));
    leaving.rooms.clear();
    await task;
    expect(readState().players.map(p => p.id)).not.toContain('u1');
    await runInRoom(CODE, () => handleRoomLeave(ns as never, makeSocket('u3') as never, [CODE]));
    expect(readState().status).toBe('LOBBY');
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
    expect(state.players.every(p => !p.isReady && !p.inAward)).toBe(true);
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

describe('커스텀 제시어 안내', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());
  it('출제 대기는 30초이며 제출 후 답안자는 글자 수와 커스텀 여부만 받는다', async () => {
    seedLobby({ config: { roundCount: 2, drawTimer: 30, answerTimer: 10, categories: ['CUSTOM'], playerCountMax: 6 } });
    const ns = makeNamespace();
    await startGame(ns);
    expect(eventsOf(ns, 'game:round:start')[0]).toMatchObject({ durationSec: 30, needsCustomPrompt: true });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(readState().status).toBe('MODE1_ROUND_START');
    await runInRoom(CODE, () => handleCustomPromptSubmit(ns as never, makeSocket('u1'), { text: '빨간 사과' }));
    const guesser = [...ns.emitted]
      .reverse()
      .find(e => e.event === 'game:round:start' && e.room === 'user:u2')?.payload;
    // 글자 수는 라운드 시작 때 내려주지 않고, 남은 시간 10초(제출 후 20초)에 game:hint로 공개한다
    expect(guesser).toMatchObject({ isCustomRound: true, durationSec: 30 });
    expect(guesser).not.toHaveProperty('promptHint');
    expect(guesser).toHaveProperty('promptForDrawer', undefined);
    expect(readState().current).toMatchObject({ prompt: '빨간 사과' });
    await vi.advanceTimersByTimeAsync(19_999);
    expect(eventsOf(ns, 'game:hint')).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(eventsOf(ns, 'game:hint')).toEqual([{ gameId: readState().gameId, roundIndex: 0, promptHint: 'ㅇㅇ ㅇㅇ' }]);
  });
  it('29초에 제시어를 제출하면 별도의 30초 그림 시간을 보장한다', async () => {
    seedLobby({ config: { roundCount: 1, drawTimer: 30, answerTimer: 10, categories: ['CUSTOM'], playerCountMax: 6 } });
    const ns = makeNamespace();
    await startGame(ns);
    await vi.advanceTimersByTimeAsync(29_000);
    await runInRoom(CODE, () => handleCustomPromptSubmit(ns as never, makeSocket('u1'), { text: '고양이' }));
    await vi.advanceTimersByTimeAsync(29_999);
    expect(readState().status).toBe('MODE1_ROUND_START');
    expect(readState().current).toMatchObject({ roundIndex: 0, prompt: '고양이' });
    await vi.advanceTimersByTimeAsync(1);
    expect(readState().status).toBe('MODE1_ROUND_END');
  });

  it('수신 시각이 29초면 방 작업 줄의 처리 지연이 있어도 제출을 인정한다', async () => {
    seedLobby({ config: { roundCount: 1, drawTimer: 30, answerTimer: 10, categories: ['CUSTOM'], playerCountMax: 6 } });
    const ns = makeNamespace();
    await startGame(ns);
    const startedAt = (readState().current as Mode1RoundCurrent).startedAt;
    vi.setSystemTime(startedAt + 30_500);
    await handleCustomPromptSubmit(ns as never, makeSocket('u1'), { text: '고양이' }, startedAt + 29_000);
    expect(readState().current).toMatchObject({ prompt: '고양이', startedAt: startedAt + 30_500 });
  });

  it('제시어를 제출하지 않으면 30초 뒤 라운드가 종료된다', async () => {
    seedLobby({ config: { roundCount: 1, drawTimer: 30, answerTimer: 10, categories: ['CUSTOM'], playerCountMax: 6 } });
    const ns = makeNamespace();
    await startGame(ns);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(readState().status).toBe('MODE1_ROUND_END');
  });
});

describe('페인트 전송 권한', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(pickRoundWord).mockResolvedValue({ word: '사과', category: 'ANIMAL' });
  });
  afterEach(() => vi.useRealTimers());
  const payload = { strokeId: 'fill', color: '#FFD21F', paintSpans: [{ x: 0, y: 0, width: 1, height: 1 }] };
  it('현재 출제자의 검증된 영역만 관전자에게 전송한다', async () => {
    seedLobby();
    const ns = makeNamespace();
    await startGame(ns);
    const socket = { ...makeSocket('u1'), to: ns.to };
    await handleStrokeFill(ns as never, socket as never, payload);
    expect(eventsOf(ns, 'stroke:remote')).toEqual([
      expect.objectContaining({ ...payload, authorId: 'u1', ended: true }),
    ]);
  });
  it('답안자·캔버스 밖 영역·제시어 입력 중에는 전송하지 않는다', async () => {
    seedLobby();
    const ns = makeNamespace();
    await startGame(ns);
    await handleStrokeFill(ns as never, { ...makeSocket('u2'), to: ns.to } as never, payload);
    const socket = { ...makeSocket('u1'), to: ns.to };
    await handleStrokeFill(ns as never, socket as never, {
      ...payload,
      paintSpans: [{ x: 0.9, y: 0, width: 1, height: 1 }],
    });
    const state = readState();
    (state.current as Mode1RoundCurrent).prompt = '';
    store.set(CODE, JSON.stringify(state));
    await handleStrokeFill(ns as never, socket as never, payload);
    expect(eventsOf(ns, 'stroke:remote')).toEqual([]);
  });
});

describe('모드2 콘텐츠 전달', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    clearRoomTimers(CODE);
    vi.useRealTimers();
  });
  it('4인 게임에서 제시어·그림·페인트·답안이 JSON 저장을 거쳐 다음 사람과 리뷰까지 전달된다', async () => {
    seedLobby({
      mode: 2,
      gameId: 'mode2-game',
      players: ['u1', 'u2', 'u3', 'u4'].map((id, index) => makePlayer(id, index)),
    });
    const ns = makeNamespace();
    await startMode2(ns as never, CODE);
    for (let stepIndex = 0; stepIndex <= 7; stepIndex++) {
      const state = readState();
      const current = state.current as import('../socket/handlers/mode2.js').Mode2Current;
      expect(current.step).toBe(stepIndex);
      for (const sheet of current.sheets) {
        const userId = currentAssignee(sortedPlayers(state), sheet.ownerIndex, stepIndex).id;
        const socket = makeSocket(userId);
        if (current.phase === 'PROMPT') {
          await runInRoom(CODE, () =>
            handleMode2Prompt(ns as never, socket, { sheetId: sheet.sheetId, text: `제시어 ${sheet.sheetId}` }),
          );
        } else if (current.phase === 'DRAW') {
          await runInRoom(CODE, () =>
            handleMode2DrawDone(ns as never, socket, {
              sheetId: sheet.sheetId,
              strokes: [
                {
                  id: 'line',
                  authorId: 'forged',
                  color: '#FF0000',
                  width: 0.02,
                  startTime: 0,
                  points: [
                    { x: 0.2, y: 0.3, t: 0 },
                    { x: 0.8, y: 0.7, t: 100 },
                  ],
                },
                {
                  id: 'paint',
                  authorId: 'forged',
                  color: '#00FFFF',
                  width: 0,
                  startTime: 1,
                  points: [],
                  paintSpans: [{ x: 0.1, y: 0.1, width: 0.5, height: 0.1 }],
                },
              ],
            }),
          );
        } else {
          const step = [...ns.emitted]
            .reverse()
            .find(
              e => e.event === 'mode2:step' && (e.payload as { assigneeId: string }).assigneeId === userId,
            )?.payload;
          expect(step).toMatchObject({
            previousContent: {
              kind: 'DRAW',
              strokes: [
                expect.objectContaining({ width: 0.02 }),
                expect.objectContaining({ paintSpans: expect.any(Array) }),
              ],
            },
          });
          await runInRoom(CODE, () =>
            handleMode2Answer(ns as never, socket, { sheetId: sheet.sheetId, text: `답안 ${stepIndex}` }),
          );
        }
      }
    }
    expect(readState().status).toBe('MODE2_REVIEW');
    const review = readState().current as Mode2ReviewState;
    expect(review.sheets).toHaveLength(4);
    for (const sheet of review.sheets) {
      expect(sheet.steps.map(step => step.content.kind)).toEqual([
        'PROMPT',
        'DRAW',
        'ANSWER',
        'DRAW',
        'ANSWER',
        'DRAW',
        'ANSWER',
        'DRAW',
      ]);
      expect(sheet.steps[0]?.content).toMatchObject({ text: `제시어 ${sheet.sheetId}` });
      expect(sheet.steps[1]?.content).toMatchObject({
        strokes: [
          expect.objectContaining({ authorId: sheet.ownerId, width: 0.02 }),
          expect.objectContaining({ paintSpans: expect.any(Array) }),
        ],
      });
    }
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

describe('게임 중 연결 끊김 유예 (백그라운드 복귀)', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(pickRoundWord).mockResolvedValue({ word: '사과', category: 'ANIMAL' });
    seedLobby({
      players: [makePlayer('u1', 0), makePlayer('u2', 1), makePlayer('u3', 2), makePlayer('u4', 3)],
      config: { roundCount: 2, drawTimer: 60, answerTimer: 10, categories: ['ANIMAL'], playerCountMax: 6 },
    });
  });

  afterEach(() => {
    clearRoomTimers(CODE);
    vi.useRealTimers();
  });

  const drawerSocket = () => ({ ...makeSocket('u1'), to: () => ({ emit: vi.fn() }) });
  const disconnect = (userId: string) =>
    runInRoom(CODE, () =>
      handleRoomLeave(makeNamespace() as never, makeSocket(userId) as never, [CODE], { graceful: true }),
    );

  it('30초 안에 다시 들어오면 퇴장되지 않고 끊겨 있던 동안의 그림·채팅을 받는다', async () => {
    const ns = makeNamespace();
    await startGame(ns);

    await disconnect('u2');
    expect(readState().players.find(p => p.id === 'u2')).toMatchObject({ connected: false });
    expect(readState().players.find(p => p.id === 'u2')?.left).toBeUndefined();

    await runInRoom(CODE, () =>
      handleStrokeStart(ns as never, drawerSocket() as never, { strokeId: 's1', color: '#000000', width: 4 }),
    );
    await runInRoom(CODE, () =>
      handleStrokeAppend(ns as never, drawerSocket() as never, { strokeId: 's1', points: [{ x: 0.1, y: 0.2, t: 1 }] }),
    );
    await runInRoom(CODE, () => handleChatSend(ns as never, makeSocket('u3') as never, { text: '안녕' }));
    await vi.advanceTimersByTimeAsync(20_000);

    const rejoined = makeSocket('u2', []);
    await runInRoom(CODE, () => handleRoomJoin(ns as never, rejoined as never, CODE));
    expect(readState().players.find(p => p.id === 'u2')).toMatchObject({ connected: true });
    expect(rejoined.emit).toHaveBeenCalledWith(
      'stroke:sync',
      expect.objectContaining({
        roundIndex: 0,
        strokes: [expect.objectContaining({ strokeId: 's1', points: [{ x: 0.1, y: 0.2, t: 1 }] })],
      }),
    );
    expect(rejoined.emit).toHaveBeenCalledWith(
      'chat:sync',
      expect.objectContaining({ messages: [expect.objectContaining({ text: '안녕' })] }),
    );

    // 유예 시간이 지나도 이미 돌아왔으므로 퇴장 처리되지 않는다
    await vi.advanceTimersByTimeAsync(20_000);
    expect(readState().players.find(p => p.id === 'u2')?.left).toBeUndefined();
  });

  it('30초가 지나도 돌아오지 않으면 퇴장 처리되고 남은 출제 순서에서 빠진다', async () => {
    const ns = makeNamespace();
    await startGame(ns);

    await disconnect('u4');
    await vi.advanceTimersByTimeAsync(29_000);
    expect(readState().players.find(p => p.id === 'u4')?.left).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(readState().players.find(p => p.id === 'u4')?.left).toBe(true);
    expect(readState().turnSchedule).toEqual(['u1', 'u2', 'u3', 'u1', 'u2', 'u3']);

    const late = makeSocket('u4', []);
    await runInRoom(CODE, () => handleRoomJoin(ns as never, late as never, CODE));
    expect(late.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'ALREADY_LEFT' }));
  });

  it('직접 나가기는 유예 없이 바로 퇴장 처리된다', async () => {
    const ns = makeNamespace();
    await startGame(ns);

    await runInRoom(CODE, () => handleRoomLeave(ns as never, makeSocket('u4') as never, [CODE]));
    expect(readState().players.find(p => p.id === 'u4')?.left).toBe(true);
  });
});
