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

// 벌칙 (모드 1 전용) — 켜면 스피디한 단판으로 시작하도록 턴·타이머 기본값을 바꿔 준다 (이후 수동 변경 가능)
export const PENALTY_TEXT_MAX_LENGTH = 20;
export const PENALTY_LOSER_MAX = 10;
export const PENALTY_PRESET = { roundCount: 1, drawTimer: 40 } as const;

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

// 모드 1 커스텀 제시어 입력 시간
export const PROMPT_DURATION_SEC = 30;

// 모드 2(이어 그리자!) 단계별 제한 시간 — 방 설정과 무관하게 고정
export const MODE2_PROMPT_SEC = 20;
export const MODE2_DRAW_SEC = 40;
export const MODE2_ANSWER_SEC = 10;
// 그리기 단계 시작 전 '{답안} 그려 주세요!' 안내 노출 시간 — 그리기 제한 시간 앞에 더해진다
export const MODE2_DRAW_CUE_MS = 2500;
// 정답 단계 시작 전 '그림을 맞혀주세요!' 안내 노출 시간 — 정답 제한 시간 앞에 더해진다
export const MODE2_ANSWER_CUE_MS = 1500;
// 마감 직전에 보낸 제출이 방 작업 줄에서 기다리는 동안 시간 초과로 버려지지 않도록 두는 여유
export const MODE2_SUBMIT_GRACE_MS = 800;

// 모드 2 정답 공개식 타임라인 — 서버 진행 타이머·앱 재생·GIF가 같은 값을 쓴다 (mode2/revealTimeline.ts).
// 발표 1건 = 상단 "내가 그린 그림은.. {단어}!" → 스케치 재생 → 하단 다음 사람 "이 그림은.. {정답}!"
// 시트 원조자의 첫 발표만 앞말을 읽을 시간을 주고, 이후 사람은 하단에서 올라온 뒤 바로 그린다
export const MODE2_REVEAL_OWNER_LEAD_MS = 2000;
export const MODE2_REVEAL_MOVE_MS = 800;
export const MODE2_REVEAL_DRAW_MS = 3600;
// 다음 사람이 정답을 말하는 시간 (마지막 그림은 같은 시간만큼 완성 장면을 유지)
export const MODE2_REVEAL_GUESS_MS = 2000;
// 다음 시트로 넘어갈 때 상단 캐릭터 테두리가 옮겨 가는 동안의 대기
export const MODE2_REVEAL_SHEET_GAP_MS = 1200;
// 공개식 말풍선 앞말 — 앱 화면과 GIF가 같은 문구를 쓴다
export const MODE2_REVEAL_TOP_LEAD = '내가 그린 그림은..';
export const MODE2_REVEAL_GUESS_LEAD = '이 그림은..';
