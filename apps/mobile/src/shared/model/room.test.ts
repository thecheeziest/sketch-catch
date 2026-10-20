import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Player, RoomState } from '@sketch-catch/shared';

type Handler = (payload: unknown) => void;

const sockets = vi.hoisted(() => [] as Array<{ handlers: Map<string, Handler> }>);

vi.mock('socket.io-client', () => ({
  io: () => {
    const handlers = new Map<string, Handler>();
    const socket = {
      handlers,
      on: (event: string, handler: Handler) => handlers.set(event, handler),
      emit: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    sockets.push(socket);
    return socket;
  },
}));
vi.mock('../config/appInfo', () => ({ APP_CLIENT_INFO: {} }));
vi.mock('../config/cosmetics', () => ({ getChatTextColor: (id: string | null | undefined) => id ?? null }));
vi.mock('../api/client', () => ({ refreshAccessToken: vi.fn() }));
vi.mock('./auth', () => ({ useAuthStore: { getState: () => ({ accessToken: 'token' }) } }));
vi.mock('./appUpdate', () => ({ useAppUpdateStore: { getState: () => ({ requireUpdate: vi.fn() }) } }));
vi.mock('./toast', () => ({ useToastStore: { getState: () => ({ show: vi.fn() }) } }));

const { useRoomStore } = await import('./room');

function player(id: string, characterId: string): Player {
  return {
    id,
    nickname: `nick-${id}`,
    friendCode: 'ABCDE',
    characterId,
    chatColorId: null,
    slot: 0,
    isHost: false,
    isReady: false,
    connected: true,
  };
}

function roomState(code: string, players: Player[]): RoomState {
  return { code, players } as RoomState;
}

function emit(event: string, payload: unknown): void {
  sockets.at(-1)!.handlers.get(event)!(payload);
}

beforeEach(() => {
  sockets.length = 0;
  useRoomStore.setState({ socket: null, roomCode: null, roomState: null, knownPlayers: {} });
});

describe('방에서 본 유저 모습 기억', () => {
  it('나가서 players에서 빠진 유저도 캐릭터를 기억한다', () => {
    useRoomStore.getState().connect('ROOM1');
    emit('room:state', roomState('ROOM1', [player('a', 'cat'), player('b', 'dog')]));
    emit('room:player:leave', { userId: 'b' });

    const { roomState: state, knownPlayers } = useRoomStore.getState();
    expect(state?.players.map(p => p.id)).toEqual(['a']);
    expect(knownPlayers.b).toEqual({ nickname: 'nick-b', characterId: 'dog', chatColorId: null });
  });

  it('입장 이벤트로 들어온 유저와 바뀐 캐릭터를 반영한다', () => {
    useRoomStore.getState().connect('ROOM1');
    emit('room:state', roomState('ROOM1', [player('a', 'cat')]));
    emit('room:player:join', { player: player('c', 'fox') });
    emit('room:state', roomState('ROOM1', [player('a', 'bear'), player('c', 'fox')]));

    const { knownPlayers } = useRoomStore.getState();
    expect(knownPlayers.a?.characterId).toBe('bear');
    expect(knownPlayers.c?.characterId).toBe('fox');
  });

  it('값이 같은 room:state가 다시 와도 기억 객체를 새로 만들지 않는다', () => {
    useRoomStore.getState().connect('ROOM1');
    emit('room:state', roomState('ROOM1', [player('a', 'cat')]));
    const before = useRoomStore.getState().knownPlayers;
    emit('room:state', roomState('ROOM1', [player('a', 'cat')]));

    expect(useRoomStore.getState().knownPlayers).toBe(before);
  });

  it('방을 나가도 남아 있다가 다른 방에 들어가면 비운다', () => {
    useRoomStore.getState().connect('ROOM1');
    emit('room:state', roomState('ROOM1', [player('a', 'cat')]));
    useRoomStore.getState().disconnect('ROOM1');
    expect(useRoomStore.getState().knownPlayers.a?.characterId).toBe('cat');

    useRoomStore.getState().connect('ROOM2');
    expect(useRoomStore.getState().knownPlayers).toEqual({});
  });
});
