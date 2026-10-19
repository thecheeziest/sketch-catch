import { PrismaClient, type Category } from '@prisma/client';
import { CURATED_FILES, readCuratedList } from './words/curated.js';

const prisma = new PrismaClient();

// 로컬 개발용 기본 제시어 — 운영과 같은 검수 목록을 넣는다.
// 영화·드라마·속담·사자성어 등 외부 소스 카테고리까지 채우려면 `pnpm words:import`를 실행한다.
async function loadWords(): Promise<{ word: string; category: Category }[]> {
  const lists = await Promise.all(
    CURATED_FILES.map(async ([category, file]) => (await readCuratedList(file)).map(word => ({ word, category }))),
  );
  return lists.flat();
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
