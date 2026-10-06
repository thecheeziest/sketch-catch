import { describe, it, expect } from 'vitest';
import type { Player, RoomState } from '@sketch-catch/shared';
import { ensureHost } from '../services/roomRules.js';

function player(id: string, nickname: string, slot: number, isHost = false): Player {
  return { id, nickname, friendCode: 'CODE0', characterId: 'cat', slot, isHost, isReady: false, connected: true };
}

function stateAfterHostLeft(title: string): { state: RoomState; departed: Player[] } {
  const host = player('u1', '감자', 0, true);
  const state = {
    code: 'ABC123',
    hostId: 'u1',
    mode: 1,
    status: 'LOBBY',
    players: [player('u2', '고구마', 1), player('u3', '당근', 2)],
    config: { roundCount: 1, drawTimer: 30, answerTimer: 10, categories: ['ANIMAL'], playerCountMax: 6 },
    scoreboard: {},
    current: null,
    title,
  } as RoomState;
  return { state, departed: [host] };
}

describe('ensureHost — 방장 승계', () => {
  it('slot이 가장 작은 참가자가 방장이 된다', () => {
    const { state, departed } = stateAfterHostLeft('아무 방');
    ensureHost(state, departed);
    expect(state.hostId).toBe('u2');
    expect(state.players.find((p) => p.id === 'u2')?.isHost).toBe(true);
  });

  it('제목이 이전 방장 이름의 기본 제목이면 새 방장 이름으로 바뀐다', () => {
    const { state, departed } = stateAfterHostLeft('감자님의 방');
    ensureHost(state, departed);
    expect(state.title).toBe('고구마님의 방');
  });

  it('매칭으로 만든 방의 기본 제목 형식("OO의 방")도 바뀐다', () => {
    const { state, departed } = stateAfterHostLeft('감자의 방');
    ensureHost(state, departed);
    expect(state.title).toBe('고구마의 방');
  });

  it('직접 정한 제목은 유지된다', () => {
    const { state, departed } = stateAfterHostLeft('금요일 그림 모임');
    ensureHost(state, departed);
    expect(state.title).toBe('금요일 그림 모임');
  });
});
