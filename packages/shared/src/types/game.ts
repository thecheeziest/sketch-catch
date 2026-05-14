// 게임 진행 이벤트 페이로드

export type RoundStart = {
  roundIndex: number;
  drawerId: string;
  promptForDrawer?: string; // 출제자만 받음
  durationSec: number;
};

export type RoundEnd = {
  roundIndex: number;
  correctUserId: string | null;
  scoreDelta: Record<string, number>;
};

export type GameResult = {
  finalScoreboard: Record<string, number>;
  ranking: Array<{ userId: string; rank: number; score: number }>;
};

export type ChatMessage = {
  id: string;
  userId: string;
  nickname: string;
  text: string;
  masked: boolean;
  createdAt: number;
};

export type Mode2Step = {
  sheetId: string;
  stepIndex: number;
  phase: 'PROMPT' | 'DRAW' | 'ANSWER';
  assigneeId: string;
  previousContent?: { kind: 'TEXT'; text: string } | { kind: 'DRAWING'; strokeCount: number };
  durationSec: number;
};

export type Mode2Review = {
  sheets: Array<{
    sheetId: string;
    steps: Array<{
      stepIndex: number;
      phase: 'PROMPT' | 'DRAW' | 'ANSWER';
      authorId: string;
      content: unknown;
      okVotes: number;
      ngVotes: number;
    }>;
  }>;
};
