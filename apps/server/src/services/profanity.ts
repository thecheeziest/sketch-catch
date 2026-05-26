import Filter from 'badwords-ko';
import Hangul from 'hangul-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// dict.txt 로드 — 미존재 시 빈 배열 fallback (빌드 시 dist로 복사 필요)
let customWords: string[] = [];
try {
  const raw = readFileSync(path.join(__dirname, 'profanity', 'dict.txt'), 'utf-8');
  customWords = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
} catch {
  // dict.txt 미존재 시 무시
}

// badwords-ko Filter 인스턴스 — 자체 사전 단어 추가
const filter = new Filter({ list: customWords });

export function profanityFilter(text: string): { masked: string; matched: string[] } {
  const matched: string[] = [];
  let masked = text;

  // badwords-ko Filter의 list에서 단어 추출
  const allWords: string[] = (filter as unknown as { options: { list: string[] } }).options.list;

  // 1차: 직접 포함 검사
  for (const word of allWords) {
    if (word.length === 0) continue;
    if (masked.includes(word)) {
      masked = masked.split(word).join('*'.repeat(word.length));
      matched.push(word);
    }
  }

  // 2차: 공백 제거 후 재검사 (자모 변형 탐지 — 공백 삽입 우회 방지)
  const noSpaceText = text.replace(/\s/g, '');
  for (const word of allWords) {
    if (word.length === 0) continue;
    if (matched.includes(word)) continue;
    if (noSpaceText.includes(word)) {
      // 공백 포함 원본에서 해당 단어 길이만큼 마스킹
      masked = masked.replace(/\s/g, '');
      masked = masked.split(word).join('*'.repeat(word.length));
      matched.push(word);
    }
  }

  // 3차: 자모 분리 정규화 후 검사 (Hangul.disassemble 활용)
  // 단, 2음절 미만이거나 자음/모음만으로 이루어진 단어는 거짓 양성이 많아 제외
  const disassembledText = Hangul.disassemble(noSpaceText).join('');
  for (const word of allWords) {
    if (word.length < 2) continue;
    if (matched.includes(word)) continue;
    const disassembledWord = Hangul.disassemble(word).join('');
    // 자모 분리 결과가 원본과 같으면(자음/모음 단독) 건너뜀 — 거짓 양성 방지
    if (disassembledWord === word) continue;
    if (disassembledText.includes(disassembledWord)) {
      masked = '***';
      matched.push(word);
    }
  }

  return { masked, matched };
}
