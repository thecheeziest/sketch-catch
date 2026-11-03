import { PROMPT_MAX_LENGTH } from '@sketch-catch/shared';
import { PrismaClient, type Category } from '@prisma/client';
import { CURATED_FILES, REVIEWABLE_FILES, readCuratedList, readReviewedList } from '../prisma/words/curated.js';

// 제시어 풀 적재 스크립트 - 게임 서버는 DB(WordPool)만 읽는다.
//   검수 목록 (prisma/words/*.json): 동물, 음식, 사물, 자연, 장소, 직업, 액션, 밈
//     - 위키 자동 분류는 카테고리와 맞지 않는 단어(곰팡이→동물, 한국→자연 등)가 섞여 들어와 사람이 검수한 목록만 쓴다.
// 영화·드라마·인물·예능·만화는 검수 확정 JSON만 사용한다. *.pending.json은 적재하지 않는다.
// 목록이 기준이라 빠진 단어는 풀에서도 지운다. 여러 번 실행해도 안전하며 월 1회 크론을 전제로 한다.
// 한 단어(공백 무시)는 한 카테고리에 한 번만 존재한다.

const prisma = new PrismaClient();

const MAX_LENGTH = PROMPT_MAX_LENGTH; // 공백 포함 15자

type WordEntry = { word: string; category: Category };

const normalizeKey = (word: string): string => word.replace(/\s/gu, '');

// 검수 목록은 사람이 확인한 그대로 쓴다 — 자동 정규화(최소 2자 등)를 거치면 곰·말·별·산 같은 한 글자 단어가 빠진다
async function importCurated(category: Category, file: string): Promise<WordEntry[]> {
  return (await readCuratedList(file)).flatMap(item => {
    const word = item.trim();
    return word && word.length <= MAX_LENGTH ? [{ word, category }] : [];
  });
}

// 같은 단어(공백 무시)가 목록 안이나 목록끼리 두 번 이상 있으면 적재 전에 중단한다
function assertUnique(curated: Array<[Category, WordEntry[]]>): void {
  const owner = new Map<string, Category>();
  const conflicts: string[] = [];
  for (const [category, entries] of curated) {
    for (const { word } of entries) {
      const key = normalizeKey(word);
      const existing = owner.get(key);
      if (existing) conflicts.push(`${word} (${existing}, ${category})`);
      owner.set(key, category);
    }
  }
  if (conflicts.length > 0) throw new Error(`검수 목록 중복 단어: ${conflicts.join(', ')}`);
}

async function save(label: Category, entries: WordEntry[]): Promise<void> {
  const unique = [...new Map(entries.map(e => [e.word, e])).values()];
  const result = await prisma.wordPool.createMany({
    data: unique.map(({ word, category }) => ({ word, category, length: word.length })),
    skipDuplicates: true,
  });
  console.log(`[words] ${label}: 후보 ${unique.length}개 중 ${result.count}개 추가`);
}

// 검수 목록 — 목록이 유일한 기준. 목록에 없는 단어는 지우고, 다른 카테고리에 있던 단어는 이 카테고리로 옮긴다.
async function syncCurated(category: Category, entries: WordEntry[]): Promise<void> {
  if (entries.length === 0) throw new Error(`${category}: 검수 목록이 비어 있어요`);
  const words = entries.map(e => e.word);
  const removed = await prisma.wordPool.deleteMany({ where: { category, word: { notIn: words } } });
  if (removed.count > 0) console.log(`[words] ${category}: 목록에서 빠진 ${removed.count}개 제거`);
  const moved = await prisma.wordPool.updateMany({
    where: { word: { in: words }, category: { not: category } },
    data: { category },
  });
  if (moved.count > 0) console.log(`[words] ${category}: 다른 카테고리에서 ${moved.count}개 이동`);
  await save(category, entries);
}

async function main(): Promise<void> {
  const curated = await Promise.all(
    CURATED_FILES.map(
      async ([category, file]) => [category, await importCurated(category, file)] as [Category, WordEntry[]],
    ),
  );
  for (const [category, file] of REVIEWABLE_FILES) {
    const words = await readReviewedList(file);
    if (words === null) {
      console.log(`[words] ${category}: 검수 완료 목록 없음 - 변경하지 않음`);
      continue;
    }
    if (words.some(word => word.trim().length > MAX_LENGTH)) throw new Error(`${file}: 15자 초과 제시어`);
    curated.push([category, words.map(word => ({ word: word.trim(), category }))]);
  }
  assertUnique(curated);
  // 긴 제시어가 다시 추첨되지 않도록 풀에서 정리한다.
  await prisma.wordPool.deleteMany({ where: { length: { gt: MAX_LENGTH } } });
  for (const [category, entries] of curated) await syncCurated(category, entries);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
