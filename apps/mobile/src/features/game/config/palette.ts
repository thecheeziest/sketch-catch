/**
 * 2c "스트림" 게임 플레이 화면 전용 색 팔레트 — 디자인 핸드오프 확정값.
 * 전역 테마(shared/config/theme)의 중립 다크 톤과 달리 보라 계열이라
 * 이 화면에서만 쓰는 값은 feature 스코프에 모아 둔다.
 */

/** 수직 구성 서페이스 (딥 → 프레임 → 패널 → 서브패널 → 베젤) */
export const gameSurface = {
  DEEP: '#0C0813',
  FRAME: '#171122',
  PANEL: '#241B34',
  SUBPANEL: '#1D1629',
  BEZEL: '#2F2440',
} as const;

/** 참가자 그리드 셀 테두리(링) */
export const playerRing = {
  DRAWER: '#FF2E6A', // 핑크 = 출제자 전용
  SOLVED: '#14C98A',
  SELECTED: '#8833FF', // 커스텀 라운드에서 출제자가 정답자 탭 선택 (디자인 외 기능 상태)
  IDLE: '#4A3A5C',
} as const;

/** 참가자 상태 점 (닉네임 아래 8×8) */
export const playerDot = {
  DRAWER: '#FF8AC0',
  SOLVED: '#2CE39F',
  GUESSING: '#C0B4D8',
  SILENT: '#4A3A5C',
} as const;

/** 상태 범례 스와치 */
export const legendSwatch = {
  DRAWER: '#FF8AC0',
  SOLVED: '#2CE39F',
  GUESSING: '#C0B4D8',
} as const;

/** 채팅 스트림 말풍선 */
export const chatStream = {
  BORDER: '#0F0A19',
  NAME_FG: '#F4ECFF',
  TEXT_FG: '#E8DFF5',
  BADGE_FG: '#C0B4D8',
  CORRECT_BG: '#14C98A',
  CORRECT_FG: '#08251A',
  /** 나이(오래됨) = 불투명 배경 밝기 단계. 오래된 → 최신. opacity 페이드 금지. */
  AGE_STEPS: ['#6A5C86', '#5B4E75', '#4C4064', '#3D3252', '#2F2440'] as const,
} as const;

export const gameText = {
  PRIMARY: '#F4ECFF',
  SECONDARY: '#CBBFE2',
  MUTED: '#B9AED2',
  WORD: '#FF2E6A',
} as const;

/** 드로잉 팔레트 16색 (8열 × 2행, 연한 색 → 진한 색 계열 묶음) */
export const drawingPalette: readonly string[] = [
  '#FF7A6E', '#D61F24', '#FFC79C', '#FF8A1F', '#7A4A24', '#FFD21F', '#A8E05A', '#17A86B',
  '#6FD3F0', '#1F5BD6', '#C4A3F5', '#7A2EE0', '#FF8AC0', '#FFFFFF', '#9A9AA6', '#14101C',
];

/**
 * 결과 오버레이(정답/오답/게임오버) — 확정안 8b.
 * 대표색(ACCENT) + 굽(ACCENT_DARK, 슬래브 하단 3D 발판) + 대표색 위 텍스트(ON_ACCENT) + 스크림 + 메타 칩.
 */
export const resultOverlay = {
  CORRECT: {
    ACCENT: '#2CE39F',
    ACCENT_DARK: '#0B6B4C',
    ON_ACCENT: '#06251A',
    SCRIM: 'rgba(6,37,26,.34)',
    CHIP_BG: '#0B6B4C',
    CHIP_FG: '#EAFFF6',
  },
  WRONG: {
    ACCENT: '#FF2E6A',
    ACCENT_DARK: '#7A0A26',
    ON_ACCENT: '#2B0410',
    SCRIM: 'rgba(42,13,22,.30)',
    CHIP_BG: '#4C1020',
    CHIP_FG: '#FFC4D5',
  },
  GAMEOVER: {
    ACCENT: '#FF2020',
    ACCENT_DARK: '#5A0A14',
    ON_ACCENT: '#2B0410',
    SCRIM: 'rgba(26,16,48,.50)',
    CHIP_BG: '#2F2440',
    CHIP_FG: '#E8DFF5',
  },
  /** 점수 칩(정답만) + 정답 슬래브(게임오버만) 공용 — 항상 노랑 */
  GOLD: { BG: '#FFD21F', FG: '#14101C', ACCENT_DARK: '#7A4A24' },
  CONFETTI_CORRECT: ['#FF2E6A', '#FFD21F', '#2CE39F', '#6FD3F0', '#C4A3F5', '#FF8AC0'],
  CONFETTI_WRONG: ['#FF2E6A', '#FF8AC0'],
  CONFETTI_GAMEOVER: ['#C4A3F5', '#C0B4D8'],
  /** ChatInputBar — 라운드 종료 구간(정답/게임오버) 비활성 배경·텍스트 */
  INPUT_ENDED_FG: '#9D90BB',
} as const;

/** 드로잉 툴바 서페이스 */
export const toolbar = {
  CONTAINER: '#171122',
  SWATCH_BORDER: '#0F0A19',
  SWATCH_SELECTED: '#FF2E6A',
  SIZE_GROUP_BG: '#241B34',
  SIZE_BTN_BG: '#1D1629',
  SIZE_BTN_SELECTED_BG: '#2F2440',
  SIZE_BTN_SELECTED_RING: '#FF2E6A',
  SIZE_DOT: '#F4ECFF',
  ERASER_BG: '#241B34',
  ERASER_RING: '#3A2D52',
  UNDO_BG: '#2F2440',
  UNDO_RING: '#4A3A5C',
  CLEAR_BG: '#3A1226',
  CLEAR_RING: '#FF2E6A',
  LABEL_FG: '#F4ECFF',
  CLEAR_LABEL_FG: '#FFC4D5',
} as const;
