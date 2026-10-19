import { describe, it, vi, expect, beforeEach } from 'vitest';

vi.mock('../db/prisma.js', () => ({
  prisma: {
    wordPool: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '../db/prisma.js';
import { pickRoundWord, pickWord } from '../services/word.service.js';

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

  it('뽑힌 카테고리가 비면 선택한 다른 카테고리로만 대체한다', async () => {
    mockFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ word: '테넷', category: 'MOVIE' }] as any);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = await pickRoundWord('MEME', ['CUSTOM', 'MEME', 'MOVIE']);

    expect(mockFindMany).toHaveBeenLastCalledWith({
      where: { category: { in: ['MOVIE'] } },
      select: { word: true, category: true },
    });
    expect(result).toEqual({ word: '테넷', category: 'MOVIE' });
  });

  it('선택한 카테고리가 전부 비면 선택하지 않은 카테고리로 대체하지 않고 null을 돌려준다', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await pickRoundWord('MEME', ['MEME']);

    expect(result).toBeNull();
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });

  it('이번 게임에 나온 단어는 제외하고 뽑는다', async () => {
    mockFindMany.mockResolvedValue([
      { word: '강아지', category: 'ANIMAL' },
      { word: '고양이', category: 'ANIMAL' },
    ] as any);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = await pickRoundWord('ANIMAL', ['ANIMAL'], ['강아지']);

    expect(result).toEqual({ word: '고양이', category: 'ANIMAL' });
  });

  it('뽑힌 카테고리를 다 썼으면 다른 선택 카테고리의 새 단어를 먼저 쓴다', async () => {
    mockFindMany
      .mockResolvedValueOnce([{ word: '강아지', category: 'ANIMAL' }] as any)
      .mockResolvedValueOnce([{ word: '피자', category: 'FOOD' }] as any);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = await pickRoundWord('ANIMAL', ['ANIMAL', 'FOOD'], ['강아지']);

    expect(result).toEqual({ word: '피자', category: 'FOOD' });
  });

  it('선택한 카테고리 단어를 전부 썼으면 중복을 허용해 게임이 멈추지 않는다', async () => {
    mockFindMany.mockResolvedValue([{ word: '강아지', category: 'ANIMAL' }] as any);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = await pickRoundWord('ANIMAL', ['ANIMAL'], ['강아지']);

    expect(result).toEqual({ word: '강아지', category: 'ANIMAL' });
  });
});
