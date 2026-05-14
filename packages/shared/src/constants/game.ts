// 캔버스 / Stroke
export const STROKE_FLUSH_INTERVAL_MS = 50; // DEVELOPER.md §8.2
export const CANVAS_TARGET_FPS = 60;

// 채팅
export const CHAT_MAX_LENGTH = 30; // GAME-01
export const CHAT_BUBBLE_DURATION_MS = 2500; // GAME-02

// 방
export const ROOM_CODE_LENGTH = 6;
export const ROOM_PLAYER_MIN = 3;
export const ROOM_PLAYER_MAX = 12;

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

// 매칭
export const MATCH_TIMEOUT_SEC = 30;

// 오프라인
export const OFFLINE_GRACE_SEC = 30;
export const MIN_PLAYERS_TO_CONTINUE = 3;
