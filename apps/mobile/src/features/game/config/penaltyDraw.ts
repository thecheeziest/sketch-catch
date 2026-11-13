// 벌칙 꼴등 추첨 연출 타이밍(ms) — draw-drumroll.wav 길이(REVEAL_MS - DRUM_START_MS)와 맞춘다
export const PENALTY_DRAW_TIMING = {
  DRUM_START_MS: 900,
  LIGHTS_OFF_MS: 2200,
  SPOT_START_MS: 3000,
  // 핀 조명 순회 전체 길이 — 후보 수와 무관하게 고정해 드럼롤과 어긋나지 않게 한다
  SPOT_TOTAL_MS: 5500,
  REVEAL_MS: 9000,
  PROMOTE_MS: 11800,
  DONE_MS: 12900,
} as const;

// 후보마다 조명을 비추는 바퀴 수
export const PENALTY_DRAW_ROUNDS = 3;
// 마지막 바퀴는 이 비율로 점점 느려진다 (앞 바퀴 1 기준)
export const PENALTY_DRAW_SLOWDOWN = { FROM: 1.1, TO: 1.7 } as const;
