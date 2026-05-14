// DEVELOPER.md §7 — 게임 상태 머신 + RoomState
import type { UserPublic } from './user.js';

export type GameMode = 1 | 2;

export type Category = 'ANIMAL' | 'FOOD' | 'OBJECT' | 'NATURE' | 'PLACE' | 'ACTION' | 'JOB';

export type RoomStatus =
  | 'LOBBY'
  | 'MODE1_ROUND_START'
  | 'MODE1_ROUND_END'
  | 'MODE2_PROMPT_PHASE'
  | 'MODE2_DRAW_PHASE'
  | 'MODE2_ANSWER_PHASE'
  | 'MODE2_REVIEW'
  | 'AWARD'
  | 'END';

export type Player = UserPublic & {
  slot: number;
  isHost: boolean;
  isReady: boolean;
  connected: boolean;
};

export type RoomConfig = {
  roundCount: number;
  drawTimer: number; // seconds
  answerTimer: number; // seconds (mode 2)
  categories: Category[];
  playerCountMax: number; // 3~12
};

export type RoomState = {
  code: string;
  hostId: string;
  mode: GameMode;
  status: RoomStatus;
  players: Player[];
  config: RoomConfig;
  scoreboard: Record<string, number>;
  current: unknown; // 모드별 라운드/시트 상태 — Phase 5+에서 확정
  startedAt?: number;
};
