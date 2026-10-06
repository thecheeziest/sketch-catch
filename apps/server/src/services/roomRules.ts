import type { Player, RoomState } from '@sketch-catch/shared';

// allReady는 서버에서만 계산 — 방장은 준비 버튼이 없으므로 제외 (LBBY-02).
// 대기실(LOBBY)이 아니거나, 아직 시상식에 머무는 유저가 있으면 시작 불가.
export function computeAllReady(state: RoomState): boolean {
  if (state.status !== 'LOBBY') return false;
  const others = state.players.filter(p => !p.isHost && !p.left);
  if (others.length === 0) return false;
  return others.every(p => p.isReady && !p.inAward);
}

// 방 생성 시 자동으로 붙는 기본 제목 형식 (REST 생성: "OO님의 방", 매칭 생성: "OO의 방")
const DEFAULT_TITLE_SUFFIXES = ['님의 방', '의 방'] as const;

/**
 * LBBY-03: 방장이 빠졌으면 slot 최소 참가자가 승계.
 * 제목이 이전 방장 이름으로 자동 생성된 기본 제목이면 새 방장 이름으로 바꾼다 (직접 정한 제목은 유지).
 * @param departedPlayers 이번에 방에서 빠진 플레이어 — 이전 방장의 닉네임을 찾는 데 쓴다
 */
export function ensureHost(state: RoomState, departedPlayers: Player[] = []): void {
  if (state.players.some(p => p.id === state.hostId)) return;
  const next = [...state.players].sort((a, b) => a.slot - b.slot)[0];
  if (!next) return;

  const previousHost = departedPlayers.find(p => p.id === state.hostId);
  const suffix = DEFAULT_TITLE_SUFFIXES.find(s => previousHost && state.title === `${previousHost.nickname}${s}`);
  if (suffix) state.title = `${next.nickname}${suffix}`;

  state.hostId = next.id;
  for (const p of state.players) p.isHost = p.id === next.id;
}

// 게임 1판의 흔적을 지우고 대기실 상태로 되돌린다 (시상식 종료, 게임 시작 실패 공용)
export function resetToLobby(state: RoomState): void {
  state.status = 'LOBBY';
  state.scoreboard = {};
  state.current = null;
  delete state.turnSchedule;
  delete state.startedAt;
  delete state.gameId;
  delete state.awardEndsAt;
  for (const p of state.players) {
    p.isReady = false;
    delete p.inAward;
    delete p.left;
  }
  state.allReady = computeAllReady(state);
}
