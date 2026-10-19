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

export async function readCuratedList(file: string): Promise<string[]> {
  return JSON.parse(await readFile(new URL(`./${file}`, import.meta.url), 'utf8')) as string[];
}
