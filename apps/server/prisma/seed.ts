import { PROMPT_MAX_LENGTH } from '@sketch-catch/shared';
import { PrismaClient, type Category } from '@prisma/client';
import { CURATED_FILES, REVIEWABLE_FILES, readCuratedList, readReviewedList } from './words/curated.js';

const prisma = new PrismaClient();

// 로컬 개발용 기본 제시어 — 운영과 같은 검수 목록을 넣는다.
// 영화·드라마·인물·예능·만화는 검수 확정 파일만 넣는다.
async function loadWords(): Promise<{ word: string; category: Category }[]> {
  const lists = await Promise.all(
    CURATED_FILES.map(async ([category, file]) => (await readCuratedList(file)).map(word => ({ word, category }))),
  );
  for (const [category, file] of REVIEWABLE_FILES) {
    const reviewed = await readReviewedList(file);
    if (reviewed) lists.push(reviewed.map(word => ({ word, category })));
  }
  return lists.flat().filter(({ word }) => word.length <= PROMPT_MAX_LENGTH);
}

async function main() {
  const data = (await loadWords()).map(({ word, category }) => ({
    word,
    category,
    length: word.length,
  }));

  const result = await prisma.wordPool.createMany({
    data,
    skipDuplicates: true,
  });

  console.log(`Seeded ${result.count} words into WordPool`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
