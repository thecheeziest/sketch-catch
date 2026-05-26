import { prisma } from '../db/prisma.js';
import type { Category } from '@sketch-catch/shared';

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
