import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Player, RoomState, RoomStatus } from '@sketch-catch/shared';

// 방 찾기 인덱스(ZSET)와 상태 키를 메모리로 흉내 낸다
const strings = vi.hoisted(() => new Map<string, string>());
const index = vi.hoisted(() => new Map<string, number>());

vi.mock('../db/redis.js', () => ({
  redis: {
    set: vi.fn(async (key: string, value: string) => {
      strings.set(key, value);
      return 'OK';
    }),
    get: vi.fn(async (key: string) => strings.get(key) ?? null),
    mget: vi.fn(async (keys: string[]) => keys.map(key => strings.get(key) ?? null)),
    del: vi.fn(async (...keys: string[]) => keys.filter(key => strings.delete(key)).length),
    zadd: vi.fn(async (_key: string, score: number, member: string) => {
      index.set(member, score);
      return 1;
    }),
    zrem: vi.fn(async (_key: string, ...members: string[]) => members.filter(m => index.delete(m)).length),
    zrevrange: vi.fn(async (_key: string, start: number, stop: number) =>
      [...index.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([member]) => member)
        .slice(start, stop + 1),
    ),
    zremrangebyscore: vi.fn(async (_key: string, _min: string, max: string) => {
      const bound = Number(max.replace('(', ''));
      let removed = 0;
      for (const [member, score] of index) {
        if (score < bound) {
          index.delete(member);
          removed++;
        }
      }
      return removed;
    }),
  },
  setPresence: vi.fn(),
}));

vi.mock('../services/roomTimers.js', () => ({ clearRoomTimers: vi.fn() }));
vi.mock('../services/chatStore.js', () => ({ clearRoomChat: vi.fn() }));
vi.mock('../services/strokeStore.js', () => ({ clearRoomStrokes: vi.fn() }));
vi.mock('../socket/presence.namespace.js', () => ({ broadcastPresenceUpdate: vi.fn() }));

const { createRoom, listRooms, saveRoomState } = await import('../services/rooms.service.js');
const { destroyRoom } = await import('../socket/handlers/award.js');

const config = {
  roundCount: 3,
  drawTimer: 60,
  answerTimer: 10,
  categories: ['ANIMAL' as const, 'FOOD' as const],
  playerCountMax: 6,
};

async function makeRoom(opts: { at: number; locked?: boolean; password?: string; title?: string }): Promise<RoomState> {
  vi.setSystemTime(opts.at);
  return createRoom({
    hostId: 'host',
    userIds: ['host'],
    config,
    title: opts.title,
    locked: opts.locked ?? false,
    password: opts.password,
    mode: 1,
    userMeta: { host: { nickname: '방장', characterId: 'cat', friendCode: 'AAAAA' } },
  });
}

async function setStatus(state: RoomState, status: RoomStatus): Promise<void> {
  await saveRoomState({ ...state, status });
}

const BASE = new Date('2026-10-19T12:00:00Z').getTime();

describe('방 찾기 목록', () => {
  beforeEach(() => {
    strings.clear();
    index.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  it('방을 만들면 인덱스에 추가되고 목록 항목으로 매핑된다', async () => {
    const room = await makeRoom({ at: BASE, title: '그림방' });

    expect(index.get(room.code)).toBe(BASE);
    expect(await listRooms()).toEqual([
      {
        code: room.code,
        title: '그림방',
        status: 'WAITING',
        mode: 1,
        playerCount: 1,
        playerCountMax: 6,
        hasPassword: false,
        inviteOnly: false,
        categories: ['ANIMAL', 'FOOD'],
      },
    ]);
  });

  it('destroyRoom이 인덱스에서도 방을 지운다', async () => {
    const room = await makeRoom({ at: BASE });
    await destroyRoom(room.code);

    expect(index.has(room.code)).toBe(false);
    expect(await listRooms()).toEqual([]);
  });

  it('대기 중인 방이 먼저, 같은 상태끼리는 최신순으로 정렬한다', async () => {
    const oldWaiting = await makeRoom({ at: BASE });
    const playing = await makeRoom({ at: BASE + 1000 });
    const award = await makeRoom({ at: BASE + 2000 });
    const newWaiting = await makeRoom({ at: BASE + 3000 });
    await setStatus(playing, 'MODE1_ROUND_START');
    await setStatus(award, 'AWARD');

    const list = await listRooms();

    expect(list.map(r => r.code)).toEqual([newWaiting.code, oldWaiting.code, award.code, playing.code]);
    expect(list.map(r => r.status)).toEqual(['WAITING', 'WAITING', 'PLAYING', 'PLAYING']);
  });

  it('인원은 퇴장·시상식 잔류 유저를 빼고 세며, 남은 인원이 없는 방은 숨긴다', async () => {
    const room = await makeRoom({ at: BASE });
    const extra = (id: string, patch: Partial<Player>): Player => ({
      ...room.players[0]!,
      id,
      isHost: false,
      ...patch,
    });
    await saveRoomState({
      ...room,
      players: [...room.players, extra('a', {}), extra('b', { left: true }), extra('c', { inAward: true })],
    });
    const empty = await makeRoom({ at: BASE + 1000 });
    await saveRoomState({ ...empty, players: [{ ...empty.players[0]!, left: true }] });

    const list = await listRooms();

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ code: room.code, playerCount: 2 });
  });

  it('비밀번호가 있는 잠금 방은 hasPassword, 비밀번호 없는 잠금 방은 inviteOnly로 표시한다', async () => {
    const secret = await makeRoom({ at: BASE, locked: true, password: '1234' });
    const invite = await makeRoom({ at: BASE + 1000, locked: true });

    const byCode = new Map((await listRooms()).map(r => [r.code, r]));

    expect(byCode.get(secret.code)).toMatchObject({ hasPassword: true, inviteOnly: false });
    expect(byCode.get(invite.code)).toMatchObject({ hasPassword: false, inviteOnly: true });
  });

  it('상태 키가 사라진 방과 TTL이 지난 인덱스 항목은 조회하면서 정리한다', async () => {
    const vanished = await makeRoom({ at: BASE });
    strings.delete(`room:${vanished.code}:state`);
    index.set('EXPIRD', BASE - 7200 * 1000 - 1);
    const alive = await makeRoom({ at: BASE + 1000 });

    const list = await listRooms();

    expect(list.map(r => r.code)).toEqual([alive.code]);
    expect([...index.keys()]).toEqual([alive.code]);
  });
});
