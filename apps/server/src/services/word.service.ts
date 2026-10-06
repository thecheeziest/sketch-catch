import { prisma } from '../db/prisma.js';
import { logger } from '../lib/logger.js';
import type { Category } from '@sketch-catch/shared';

const WORD_CATEGORIES: Category[] = ['ANIMAL', 'FOOD', 'OBJECT', 'NATURE', 'PLACE', 'ACTION', 'JOB'];

export async function pickWord(categories: Category[]): Promise<{ word: string; category: Category }> {
  const cats = categories.length > 0 ? categories : (['ANIMAL'] as Category[]);
  const candidates = await prisma.wordPool.findMany({
    where: { category: { in: cats } },
    select: { word: true, category: true },
  });
  if (candidates.length === 0) {
    throw new Error('WORD_POOL_EMPTY');
  }
  const picked = candidates[Math.floor(Math.random() * candidates.length)]!;
  return { word: picked.word, category: picked.category as Category };
}

// 라운드 제시어 — 뽑힌 카테고리가 비어 있으면 방에서 선택한 다른 카테고리, 그래도 없으면 전체 카테고리로 대체.
// 전부 비어 있으면 null (호출 측이 게임을 취소한다). 빈 풀 때문에 서버가 죽지 않도록 throw하지 않는다.
export async function pickRoundWord(
  preferred: Category,
  selected: Category[],
): Promise<{ word: string; category: Category } | null> {
  const others = selected.filter(c => c !== 'CUSTOM' && c !== preferred);
  const tiers = [[preferred], others, WORD_CATEGORIES].filter(tier => tier.length > 0);

  for (const tier of tiers) {
    try {
      return await pickWord(tier);
    } catch (err) {
      if (!(err instanceof Error) || err.message !== 'WORD_POOL_EMPTY') throw err;
      logger.warn({ categories: tier }, 'word pool empty, falling back');
    }
  }
  return null;
}
