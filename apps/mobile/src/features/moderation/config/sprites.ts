import type { PixelSpriteData } from '@sketch-catch/shared';
import { colors } from '@/shared/config';

// 사람 + 금지 표시 — 친구 삭제(사람 + 빼기)와 겹치지 않게 원형 금지 기호를 쓴다
export const BLOCK_SPRITE: PixelSpriteData = {
  rows: [
    '..lll........',
    '.lllll.......',
    '.lllll...rrr.',
    '..lll...rr..r',
    '........r.r.r',
    '.lllll..r..rr',
    'lllllll..rrr.',
    'lllllll......',
    'lllllll......',
  ],
  colors: { l: colors.LIGHT_500, r: colors.ERROR_300 },
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
