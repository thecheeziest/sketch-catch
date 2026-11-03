import { readFile } from 'node:fs/promises';
import type { Category } from '@prisma/client';

// 사람이 검수한 제시어 목록 — 운영 적재(scripts/import-words.ts)와 로컬 시드(prisma/seed.ts)가 같은 목록을 쓴다.
// 위키 자동 분류는 카테고리와 맞지 않는 단어(곰팡이→동물, 한국→자연 등)가 섞여 들어와 이 카테고리들은 목록만 기준으로 한다.
export const CURATED_FILES: ReadonlyArray<readonly [Category, string]> = [
  ['ANIMAL', 'animal.json'],
  ['FOOD', 'food.json'],
  ['OBJECT', 'object.json'],
  ['NATURE', 'nature.json'],
  ['PLACE', 'place.json'],
  ['JOB', 'job.json'],
  ['ACTION', 'action.json'],
  ['MEME', 'meme.json'],
];

// 검수 후 *.pending.json의 내용을 해당 *.json으로 확정하고 pending은 []로 비운다.
// 아직 확정 파일이 없으면 해당 카테고리는 변경하지 않는다.
export const REVIEWABLE_FILES: ReadonlyArray<readonly [Category, string]> = [
  ['PERSON', 'person.json'],
  ['MOVIE', 'movie.json'],
  ['DRAMA', 'drama.json'],
  ['VARIETY', 'variety.json'],
  ['ANIMATION', 'animation.json'],
];

export async function readReviewedList(file: string): Promise<string[] | null> {
  try {
    return await readCuratedList(file);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function readCuratedList(file: string): Promise<string[]> {
  const list: unknown = JSON.parse(await readFile(new URL(`./${file}`, import.meta.url), 'utf8'));
  if (
    !Array.isArray(list) ||
    !list.every((word): word is string => typeof word === 'string' && word.trim().length > 0)
  ) {
    throw new Error(`${file}: 비어 있지 않은 문자열 배열이 필요해요`);
  }
  return list;
}
