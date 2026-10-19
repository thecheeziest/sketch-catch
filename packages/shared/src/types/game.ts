// 게임 진행 이벤트 페이로드

import type { Stroke } from './stroke.js';

// Phase 5 — 모드 1 라운드 진행 상태 (RoomState.current에 담김)
export type Mode1RoundCurrent = {
  roundIndex: number;
  drawerId: string;
  prompt: string; // 제시어 (서버 전용 — 출제자 외 노출 금지)
  isCustomRound?: boolean;
  startedAt: number; // 라운드 시작 epoch ms
};

export type RoundStart = {
  gameId: string;
  roundIndex: number;
  drawerId: string;
  promptForDrawer?: string; // 출제자만 받음
  durationSec: number;
  promptHint?: string;
  isCustomRound?: boolean;
  promptInputEndsAt?: number;
  needsCustomPrompt?: boolean; // 커스텀 정답 모드: 출제자가 직접 제시어를 입력해야 함
};

export type RoundEnd = {
  gameId: string;
  roundIndex: number;
  correctUserId: string | null;
  scoreDelta: Record<string, number>;
  // 라운드 종료 시점엔 더 이상 비밀이 아니므로 전원에게 공개 (결과 오버레이의 정답 표시용)
  answer: string;
};

export type GameResult = {
  gameId: string;
  finalScoreboard: Record<string, number>;
  ranking: Array<{ userId: string; rank: number; score: number; answeredAt: number | null }>;
  endReason?: 'NORMAL' | 'INSUFFICIENT_PLAYERS';
};

// 게임 종료 코인 정산 — 플레이어 본인 소켓(user:{id})에만 전달
export type CoinRewardReason = 'COMPLETE' | 'FIRST_GAME' | 'CORRECT' | 'DRAWING_SOLVED' | 'RANK' | 'SUBMIT';

export type CoinRewardLine = {
  reason: CoinRewardReason;
  amount: number;
  count?: number; // 정답·그림·제출 횟수
  rank?: number; // RANK일 때 순위
};

export type CoinReward = {
  gameId: string;
  mode: 1 | 2;
  lines: CoinRewardLine[];
  total: number; // 실제 지급액 (하루 상한 반영)
  balance: number; // 지급 후 보유 코인
  todayEarned: number; // 오늘 게임으로 얻은 코인 (첫 완주 보너스 제외)
  dailyCap: number;
  capped: boolean; // 상한에 걸려 일부 또는 전부 지급되지 않음
};

export type ChatMessage = {
  id: string;
  userId: string;
  nickname: string;
  text: string;
  masked: boolean;
  createdAt: number;
  // 채팅이 오가는 장소 — 미지정이면 게임 중 채팅. 대기실·시상식 채팅은 해당 장소의 인원에게만 전달된다
  channel?: 'LOBBY' | 'AWARD';
};

export type Mode2Phase = 'PROMPT' | 'DRAW' | 'ANSWER';

// 시트 스텝 콘텐츠 (서버 저장 + 리뷰/GIF 재생, D-14 텍스트+스트로크 혼합)
export type Mode2StepContent =
  | { kind: 'PROMPT'; authorId: string; text: string }
  | { kind: 'DRAW'; authorId: string; strokes: Stroke[] }
  | { kind: 'ANSWER'; authorId: string; text: string };

// 서버 → 클라이언트: 현재 단계 (mode2:step)
export type Mode2Step = {
  gameId: string;
  sheetId: string; // = 시트 원조자 userId
  stepIndex: number; // 0-indexed. 0=PROMPT, 홀수=DRAW, 짝수(0제외)=ANSWER
  phase: Mode2Phase;
  assigneeId: string; // 이번 단계 담당자
  previousContent?: // 이전 단계 참고 콘텐츠 (PROMPT 단계에서는 없음)
    { kind: 'TEXT'; text: string } | { kind: 'DRAW'; strokes: Stroke[] };
  durationSec: number;
  // 마감까지 남은 시간 (전송 시점 기준). 기기 시계 차이에 흔들리지 않도록 절대 시각 대신 상대값을 보낸다.
  // DRAW 단계는 '그려 주세요' 안내 시간(cueMs)이 앞에 포함된다
  remainingMs: number;
  cueMs?: number; // DRAW 단계 시작 안내 노출 시간 중 남은 시간
  totalSteps: number; // = 2N (참가자마다 정답(원조자는 제시어) + 그림)
};

export type Mode2ReviewSheet = {
  sheetId: string;
  ownerId: string;
  steps: Array<{ stepIndex: number; phase: Mode2Phase; authorId: string; content: Mode2StepContent }>;
};

// 실시간 정답 공개식에서 지금 발표 중인 위치. leadMs는 이 발표가 시작되기까지 남은 대기 시간
// (새 시트의 첫 발표는 상단 테두리가 옮겨 가는 MODE2_REVEAL_SHEET_GAP_MS만큼 늦게 시작한다)
export type Mode2RevealLive = { sheetIndex: number; entryIndex: number; leadMs: number; elapsedMs: number };

// 서버 → 클라이언트: 정답 공개식 진행 상태 (mode2:review). live=null이면 실시간 발표가 모두 끝난 상태
export type Mode2ReviewState = {
  gameId: string;
  sheets: Mode2ReviewSheet[];
  live: Mode2RevealLive | null;
};
