import { describe, it, expect } from 'vitest';
import { profanityFilter } from '../services/profanity.js';

describe('profanity (GAME-01)', () => {
  it('profanity: 사전 단어를 *** 로 마스킹하고 masked=true', () => {
    // dict.txt에 추가된 '테스트욕설' 단어 검증
    const result = profanityFilter('이건 테스트욕설 입니다');
    expect(result.masked).not.toBe('이건 테스트욕설 입니다');
    expect(result.masked).toContain('*');
    expect(result.matched.length).toBeGreaterThan(0);
  });

  it('profanity: 자모 분리 변형도 탐지한다', () => {
    // 공백 삽입 변형: '테 스 트 욕 설' — 공백 제거 후 재검사
    const result = profanityFilter('테 스 트 욕 설');
    expect(result.matched.length).toBeGreaterThan(0);
  });

  it('profanity: 정상 텍스트는 masked=false', () => {
    const result = profanityFilter('안녕하세요 반갑습니다');
    expect(result.masked).toBe('안녕하세요 반갑습니다');
    expect(result.matched.length).toBe(0);
  });
});

describe('drawer chat (GAME-01)', () => {
  it.todo('drawer chat: 출제자의 chat:send는 서버에서 차단된다');
});
