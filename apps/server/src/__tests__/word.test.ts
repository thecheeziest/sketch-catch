import { describe, it, vi, expect, beforeEach } from 'vitest';

vi.mock('../db/prisma.js', () => ({
  prisma: {
    wordPool: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '../db/prisma.js';
import { pickWord } from '../services/word.service.js';

const mockFindMany = vi.mocked(prisma.wordPool.findMany);

describe('word service (GAME-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('단일 카테고리 전달 시 해당 카테고리 where in으로 findMany 호출 후 단어 반환', async () => {
    const candidates = [
      { word: '강아지', category: 'ANIMAL' as const },
      { word: '고양이', category: 'ANIMAL' as const },
    ];
    mockFindMany.mockResolvedValue(candidates as any);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = await pickWord(['ANIMAL']);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { category: { in: ['ANIMAL'] } },
      select: { word: true, category: true },
    });
    expect(result).toEqual({ word: '강아지', category: 'ANIMAL' });
  });

  it('여러 카테고리 전달 시 모든 카테고리가 where in 절에 포함됨', async () => {
    const candidates = [
      { word: '강아지', category: 'ANIMAL' as const },
      { word: '피자', category: 'FOOD' as const },
    ];
    mockFindMany.mockResolvedValue(candidates as any);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    await pickWord(['ANIMAL', 'FOOD']);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { category: { in: ['ANIMAL', 'FOOD'] } },
      select: { word: true, category: true },
    });
  });

  it('후보가 빈 배열이면 WORD_POOL_EMPTY 에러를 throw한다', async () => {
    mockFindMany.mockResolvedValue([]);

    await expect(pickWord(['ANIMAL'])).rejects.toThrow('WORD_POOL_EMPTY');
  });
});
