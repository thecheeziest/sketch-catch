// DEVELOPER.md §7 — 게임 상태 머신 + RoomState
import type { UserPublic } from './user.js';

export type GameMode = 1 | 2;

export type Category = 'ANIMAL' | 'FOOD' | 'OBJECT' | 'NATURE' | 'PLACE' | 'ACTION' | 'JOB' | 'CUSTOM';

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
  left?: boolean; // 게임 중 자발적 퇴장
  // 시상식(AWARD)에 아직 머무는 중 — [한번 더!]를 누르면 false, 시상식 만료 시 true인 유저는 퇴장 처리
  inAward?: boolean;
};

export type RoomConfig = {
  roundCount: number;
  drawTimer: number; // seconds
  answerTimer: number; // seconds (mode 2)
  categories: Category[];
  playerCountMax: number; // mode1=3~12, mode2=4~12
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
  title?: string;
  locked?: boolean;
  // 서버에서만 계산 — 클라이언트 단독 계산 금지 (보안 원칙)
  allReady?: boolean;
  // 모드1: 게임 시작 시 계산된 출제자 순서 (userId[])
  turnSchedule?: string[];
  // 게임 1판의 식별자 — 시작마다 새로 발급, 대기실 복귀 시 제거. 지난 게임의 타이머·이벤트를 걸러내는 기준
  gameId?: string;
  // 시상식 종료 시각 (epoch ms) — 클라이언트 카운트다운 표시용, 실제 만료는 서버 타이머가 처리
  awardEndsAt?: number;
};
