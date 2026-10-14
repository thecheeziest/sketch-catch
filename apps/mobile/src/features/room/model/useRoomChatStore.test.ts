import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage, RoomState } from '@sketch-catch/shared';

type Handler = (payload: never) => void;
const listeners = vi.hoisted(() => new Map<string, Handler>());
const fakeSocket = vi.hoisted(() => ({
  on: (event: string, handler: Handler) => void listeners.set(event, handler),
  off: (event: string) => void listeners.delete(event),
}));

vi.mock('@/shared/model/room', () => ({ useRoomStore: { getState: () => ({ socket: fakeSocket }) } }));

const { useRoomChatStore } = await import('./useRoomChatStore');

function message(id: string, channel?: ChatMessage['channel']): ChatMessage {
  return { id, userId: 'u1', nickname: '닉', text: id, masked: false, createdAt: 0, channel };
}

function emitState(gameId?: string): void {
  listeners.get('room:state')?.({ gameId } as never as RoomState as never);
}

describe('useRoomChatStore', () => {
  let unregister: () => void;

  beforeEach(() => {
    listeners.clear();
    unregister = useRoomChatStore.getState().registerRoomChatListeners();
  });

  it('채널별로 메시지를 나눠 담고 게임 채팅(채널 없음)은 무시한다', () => {
    const chat = listeners.get('chat:message')!;
    chat(message('lobby', 'LOBBY') as never);
    chat(message('award', 'AWARD') as never);
    chat(message('game') as never);
    expect(useRoomChatStore.getState().lobbyMessages.map(m => m.id)).toEqual(['lobby']);
    expect(useRoomChatStore.getState().awardMessages.map(m => m.id)).toEqual(['award']);
    unregister();
  });

  it('게임이 시작되면 대기실·시상식 채팅이 모두 비워진다', () => {
    const chat = listeners.get('chat:message')!;
    chat(message('lobby', 'LOBBY') as never);
    chat(message('award', 'AWARD') as never);
    emitState('game-1');
    expect(useRoomChatStore.getState().lobbyMessages).toEqual([]);
    expect(useRoomChatStore.getState().awardMessages).toEqual([]);
    unregister();
  });

  it('시상식에서 대기실로 복귀하면 대기실 채팅만 비우고 시상식 채팅은 유지한다', () => {
    emitState('game-1');
    const chat = listeners.get('chat:message')!;
    chat(message('award', 'AWARD') as never);
    chat(message('old-lobby', 'LOBBY') as never);
    emitState(undefined);
    expect(useRoomChatStore.getState().lobbyMessages).toEqual([]);
    expect(useRoomChatStore.getState().awardMessages.map(m => m.id)).toEqual(['award']);
    unregister();
  });

  it('같은 gameId의 room:state로는 초기화되지 않는다', () => {
    const chat = listeners.get('chat:message')!;
    chat(message('lobby', 'LOBBY') as never);
    emitState(undefined);
    emitState(undefined);
    expect(useRoomChatStore.getState().lobbyMessages.map(m => m.id)).toEqual(['lobby']);
    unregister();
  });
});
