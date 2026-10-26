// 말풍선 글자는 구간의 앞 70% 동안 타이핑되고 나머지는 멈춰서 읽을 시간을 준다
const TYPING_RATIO = 0.7;

// 한글 음절도 1글자씩 끊기도록 코드 포인트 단위로 자른다
export function typeText(full: string, progress: number): string {
  const chars = Array.from(full);
  const count = Math.ceil(chars.length * Math.min(1, Math.max(0, progress) / TYPING_RATIO));
  return chars.slice(0, count).join('');
}
