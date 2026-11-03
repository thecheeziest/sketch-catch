import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { PROMPT_MAX_LENGTH } from '@sketch-catch/shared';

const WORDS_DIR = new URL('../../prisma/words/', import.meta.url);
// 제시어가 아닌 메타데이터 파일
const NON_WORD_FILES = new Set(['candidates.sources.json']);

describe('제시어 목록', () => {
  it('확정·검수 대기 목록 전체에서 15자 이하이며 공백 제외 중복이 없다', async () => {
    const files = (await readdir(WORDS_DIR)).filter(file => file.endsWith('.json') && !NON_WORD_FILES.has(file));
    const owner = new Map<string, string>();
    const duplicates: string[] = [];

    for (const file of files.sort()) {
      const words: unknown = JSON.parse(await readFile(new URL(file, WORDS_DIR), 'utf8'));
      expect(Array.isArray(words), file).toBe(true);
      for (const word of words as string[]) {
        expect(typeof word, file).toBe('string');
        expect(word.trim(), file).toBe(word);
        expect(word.length, `${file}: ${word}`).toBeLessThanOrEqual(PROMPT_MAX_LENGTH);
        const key = word.replace(/\s/gu, '');
        const existing = owner.get(key);
        if (existing) duplicates.push(`${word} (${existing}, ${file})`);
        owner.set(key, file);
      }
    }

    expect(duplicates).toEqual([]);
  });
});
