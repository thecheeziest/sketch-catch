import type { CoinRewardLine } from '@sketch-catch/shared';

// 정산 내역 한 줄의 문구 — 모드2의 완주는 "공개식 완주"로 부른다
export function getRewardLineLabel(line: CoinRewardLine, mode: 1 | 2): string {
  switch (line.reason) {
    case 'COMPLETE':
      return mode === 2 ? '공개식 완주' : '완주';
    case 'FIRST_GAME':
      return '오늘 첫 완주';
    case 'CORRECT':
      return `정답 ${line.count ?? 0}회`;
    case 'DRAWING_SOLVED':
      return `내 그림 맞힌 사람 ${line.count ?? 0}명`;
    case 'RANK':
      return `${line.rank ?? 0}위 보너스`;
    case 'SUBMIT':
      return `제출 ${line.count ?? 0}회`;
  }
}

export function isHighlightLine(line: CoinRewardLine): boolean {
  return line.reason === 'RANK' || line.reason === 'FIRST_GAME';
}
