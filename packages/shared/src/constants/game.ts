// 캔버스 / Stroke
export const STROKE_FLUSH_INTERVAL_MS = 50; // DEVELOPER.md §8.2
export const CANVAS_TARGET_FPS = 60;

// 채팅
export const CHAT_MAX_LENGTH = 30; // GAME-01
export const CHAT_BUBBLE_DURATION_MS = 2500; // GAME-02

// 방
export const ROOM_CODE_LENGTH = 6;
export const ROOM_PLAYER_MIN = 3;
export const MODE2_PLAYER_MIN = 4;
export const ROOM_PLAYER_MAX = 12;

// 시상식 유지 시간 — 모드2는 GIF 저장 시간을 확보하기 위해 더 길게
export const AWARD_DURATION_SEC = { 1: 30, 2: 60 } as const;

// 친구
export const FRIEND_CODE_LENGTH = 5;

// 닉네임
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 10;
export const NICKNAME_CHANGE_COOLDOWN_DAYS = 30; // PROF-01

// 모드 1 점수
export const MODE1_SCORE_MIN = 100;
export const MODE1_SCORE_MAX_BASE = 1000;
export const MODE1_SCORE_DECAY_PER_SEC = 30;
export const MODE1_DRAWER_BONUS_RATIO = 0.5;
export const MODE1_DRAWER_BONUS_CAP = 500;

// 매칭 로비 카운트다운 — ROOM_PLAYER_MIN 도달 시 시작, 막판 입장 시 연장, HARD_CAP 내로 제한
export const MATCH_COUNTDOWN_MS = 20_000;
export const MATCH_EXTEND_THRESHOLD_MS = 5_000; // 잔여시간이 이 값 미만일 때 입장하면 연장
export const MATCH_EXTEND_MS = 8_000;
export const MATCH_HARD_CAP_MS = 45_000; // 카운트다운 시작 시점부터 최대 대기

// 오프라인
export const OFFLINE_GRACE_SEC = 30;
export const MIN_PLAYERS_TO_CONTINUE = 3;

// 직접 제시어 입력 시간 — 두 모드 공통
export const PROMPT_DURATION_SEC = 20;
