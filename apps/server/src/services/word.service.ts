import { prisma } from '../db/prisma.js';
import { logger } from '../lib/logger.js';
import { PROMPT_MAX_LENGTH, type Category } from '@sketch-catch/shared';

const NO_EXCLUDED_WORDS: ReadonlySet<string> = new Set();

// excluded에 든 단어는 후보에서 뺀다 — 남은 후보가 없으면 빈 풀과 같이 WORD_POOL_EMPTY
export async function pickWord(
  categories: Category[],
  excluded: ReadonlySet<string> = NO_EXCLUDED_WORDS,
): Promise<{ word: string; category: Category }> {
  const cats = categories.length > 0 ? categories : (['ANIMAL'] as Category[]);
  const candidates = await prisma.wordPool.findMany({
    where: { category: { in: cats } },
    select: { word: true, category: true },
  });
  const available = candidates.filter(c => !excluded.has(c.word) && c.word.length <= PROMPT_MAX_LENGTH);
  if (available.length === 0) {
    throw new Error('WORD_POOL_EMPTY');
  }
  const picked = available[Math.floor(Math.random() * available.length)]!;
  return { word: picked.word, category: picked.category as Category };
}

// 라운드 제시어 — 뽑힌 카테고리가 비어 있으면 방에서 선택한 다른 카테고리로만 대체한다.
// 선택하지 않은 카테고리의 제시어는 절대 내지 않는다. 전부 비어 있으면 null (호출 측이 게임을 취소한다).
// 이번 게임(usedWords)과 직전 판들(recentGameWords, 오래된 판부터)에 나온 단어는 먼저 제외한다.
// 선택한 카테고리를 다 써 버리면 가장 오래된 판부터 한 판씩 다시 허용하고, 마지막에만 이번 게임 단어도 허용한다.
// 빈 풀 때문에 서버가 죽지 않도록 throw하지 않는다.
export async function pickRoundWord(
  preferred: Category,
  selected: Category[],
  usedWords: readonly string[] = [],
  recentGameWords: readonly (readonly string[])[] = [],
): Promise<{ word: string; category: Category } | null> {
  const others = selected.filter(c => c !== 'CUSTOM' && c !== preferred);
  const tiers = [[preferred], others].filter(tier => tier.length > 0);
  const exclusions: ReadonlySet<string>[] = recentGameWords.map(
    (_, index) => new Set([...usedWords, ...recentGameWords.slice(index).flat()]),
  );
  if (usedWords.length > 0) exclusions.push(new Set(usedWords));
  exclusions.push(NO_EXCLUDED_WORDS);

  for (const excluded of exclusions) {
    for (const tier of tiers) {
      try {
        return await pickWord(tier, excluded);
      } catch (err) {
        if (!(err instanceof Error) || err.message !== 'WORD_POOL_EMPTY') throw err;
        logger.warn({ categories: tier, excludedCount: excluded.size }, 'word pool empty, falling back');
      }
    }
  }
  return null;
}
