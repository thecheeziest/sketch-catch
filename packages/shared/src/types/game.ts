// 게임 진행 이벤트 페이로드

import type { Stroke } from './stroke.js';

// Phase 5 — 모드 1 라운드 진행 상태 (RoomState.current에 담김)
export type Mode1RoundCurrent = {
  roundIndex: number;
  drawerId: string;
  prompt: string;    // 제시어 (서버 전용 — 출제자 외 노출 금지)
  startedAt: number; // 라운드 시작 epoch ms
};

export type RoundStart = {
  roundIndex: number;
  drawerId: string;
  promptForDrawer?: string; // 출제자만 받음
  durationSec: number;
  needsCustomPrompt?: boolean; // 커스텀 정답 모드: 출제자가 직접 제시어를 입력해야 함
};

export type RoundEnd = {
  roundIndex: number;
  correctUserId: string | null;
  scoreDelta: Record<string, number>;
};

export type GameResult = {
  finalScoreboard: Record<string, number>;
  ranking: Array<{ userId: string; rank: number; score: number; answeredAt: number | null }>;
};

export type ChatMessage = {
  id: string;
  userId: string;
  nickname: string;
  text: string;
  masked: boolean;
  createdAt: number;
};

export type Mode2Phase = 'PROMPT' | 'DRAW' | 'ANSWER';

// 시트 스텝 콘텐츠 (서버 저장 + 리뷰/GIF 재생, D-14 텍스트+스트로크 혼합)
export type Mode2StepContent =
  | { kind: 'PROMPT'; authorId: string; text: string }
  | { kind: 'DRAW'; authorId: string; strokes: Stroke[] }
  | { kind: 'ANSWER'; authorId: string; text: string };

// 서버 → 클라이언트: 현재 단계 (mode2:step)
export type Mode2Step = {
  sheetId: string; // = 시트 원조자 userId
  stepIndex: number; // 0-indexed. 0=PROMPT, 홀수=DRAW, 짝수(0제외)=ANSWER
  phase: Mode2Phase;
  assigneeId: string; // 이번 단계 담당자
  previousContent?: // 이전 단계 참고 콘텐츠 (PROMPT 단계에서는 없음)
    | { kind: 'TEXT'; text: string }
    | { kind: 'DRAW'; strokes: Stroke[] };
  durationSec: number;
  totalSteps: number; // = N (참가자 수)
};

// 최종 판정 (D-02): 원조자가 마지막 단계 결과를 보고 O/X 1회
export type Mode2FinalJudge = { ok: boolean; judgedBy: string };

export type Mode2ReviewSheet = {
  sheetId: string;
  ownerId: string;
  steps: Array<{ stepIndex: number; phase: Mode2Phase; authorId: string; content: Mode2StepContent }>;
  finalJudge: Mode2FinalJudge | null; // D-02: 단계별 투표 집계 대체
};

// 서버 → 클라이언트: 리뷰 진행 상태 (mode2:review). 서버 타이머가 자동 전환(D-01/D-03)
export type Mode2ReviewState = {
  subPhase: 'FINAL_JUDGE' | 'SLIDESHOW' | 'BEST_VOTE' | 'BEST_REVEAL';
  currentSheetIndex: number; // FINAL_JUDGE/SLIDESHOW 진행 중 시트
  currentFrameIndex?: number; // SLIDESHOW 프레임 위치
  sheets: Mode2ReviewSheet[];
  bestSheetIds?: string[]; // BEST_REVEAL: 최다 득표(동률 공동, D-07)
};
