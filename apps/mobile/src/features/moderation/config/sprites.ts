import type { PixelSpriteData } from '@sketch-catch/shared';
import { colors } from '@/shared/config';

// 같은 사람 실루엣과 10×10도트 배지 — 차단은 가는 금지 표시, 삭제는 빼기 표시.
export const BLOCK_SPRITE: PixelSpriteData = {
  rows: [
    '....................',
    '.....llll...........',
    '....llllll..........',
    '....llllll..........',
    '....llllll..........',
    '....llllll..........',
    '.....llll...........',
    '....................',
    '....................',
    '...llllllll.........',
    '..llllllll...rrrr...',
    '.lllllllll..r....r..',
    '.lllllllll.r......r.',
    '.lllllllllr......r.r',
    '.lllllllllr.....r..r',
    '.lllllllllr....r...r',
    '..llllllllr...r....r',
    '...........r.r....r.',
    '............r....r..',
    '.............rrrr...',
  ],
  colors: { l: colors.LIGHT_500, r: colors.ERROR_300 },
};

export const UNFRIEND_SPRITE: PixelSpriteData = {
  rows: [
    '....................',
    '.....llll...........',
    '....llllll..........',
    '....llllll..........',
    '....llllll..........',
    '....llllll..........',
    '.....llll...........',
    '....................',
    '....................',
    '...llllllll.........',
    '..llllllll...rrrr...',
    '.lllllllll..rrrrrr..',
    '.lllllllll.rrrrrrrr.',
    '.lllllllllrrrrrrrrrr',
    '.lllllllllrrwwwwwwrr',
    '.lllllllllrrwwwwwwrr',
    '..llllllllrrrrrrrrrr',
    '...........rrrrrrrr.',
    '............rrrrrr..',
    '.............rrrr...',
  ],
  colors: { l: colors.LIGHT_500, r: colors.ERROR_300, w: colors.WHITE },
};

// 경광등 — 신고
export const REPORT_SPRITE: PixelSpriteData = {
  rows: [
    '....y....',
    '.y.....y.',
    '...rrr...',
    '..rrwrr..',
    '..rwrrr..',
    '..rrrrr..',
    '.rrrrrrr.',
    'lllllllll',
    'lllllllll',
  ],
  colors: { l: colors.LIGHT_500, r: colors.ERROR_300, w: colors.WHITE, y: colors.WARNING_300 },
};

// 신고 사유 — 서버 ReportReason과 같은 순서
export const REPORT_REASONS = [
  { value: 'ABUSE', label: '욕설·비방' },
  { value: 'SEXUAL', label: '음란·성적인 내용' },
  { value: 'SPAM', label: '도배·광고' },
  { value: 'OTHER', label: '기타' },
] as const;
