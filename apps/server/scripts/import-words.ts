import { PrismaClient, type Category } from '@prisma/client';
import { CURATED_FILES, readCuratedList } from '../prisma/words/curated.js';

// 제시어 풀 적재 스크립트 - 외부 호출은 이 스크립트에서만 하고, 게임 서버는 DB(WordPool)만 읽는다.
//   검수 목록 (prisma/words/*.json): 동물, 음식, 사물, 자연, 장소, 직업, 행동, 밈
//     - 위키 자동 분류는 카테고리와 맞지 않는 단어(곰팡이→동물, 한국→자연 등)가 섞여 들어와 사람이 검수한 목록만 쓴다.
//   공개 소스 (모두 상업적 이용 가능한 라이선스, API 키 불필요):
//     - 한국어 위키낱말사전 분류 (CC BY-SA 4.0): 속담, 사자성어
//     - Wikidata (CC0): 영화, 드라마
// 모든 카테고리는 목록·소스가 기준이라 빠진 단어는 풀에서도 지운다. 여러 번 실행해도 안전하며 월 1회 크론을 전제로 한다.
// 한 단어(공백 무시)는 한 카테고리에만 존재한다 - 검수 목록이 우선이고, 소스 단어가 다른 카테고리와 겹치면 건너뛴다.

const prisma = new PrismaClient();

const USER_AGENT = 'SketchCatchWordImporter/1.0 (hobby project; word pool import)';
const MIN_LENGTH = 2;
const MAX_LENGTH = 20; // 커스텀 제시어 최대 길이와 동일
const REQUEST_GAP_MS = 1000; // 위키미디어 서버에 부담을 주지 않도록 요청 간격을 둔다
const MOVIE_MIN_SITELINKS = 45;
const DRAMA_MIN_SITELINKS = 4;
// 소스에서 가져온 개수가 기존 개수의 이 비율 미만이면 정리(삭제)를 건너뛴다 (위키 장애·빈 응답 대비)
const MIN_KEEP_RATIO = 0.5;

type WordEntry = { word: string; category: Category };

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// 부제(`: …`, ` - …`)와 괄호 보충 설명을 떼고, 게임에서 쓸 수 있는 길이만 통과시킨다.
function normalizeWord(raw: string): string | null {
  const cleaned = raw
    .replace(/\([^)]*\)/gu, '')
    .replace(/\s*[:\-–]\s.*$/u, '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (cleaned.length < MIN_LENGTH || cleaned.length > MAX_LENGTH) return null;
  return cleaned;
}

async function fetchJson<T>(url: string, init: RequestInit = {}, attempts = 5): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await sleep(REQUEST_GAP_MS);
    const response = await fetch(url, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...init.headers },
    });
    if (response.ok) return (await response.json()) as T;
    // 429/5xx는 잠시 쉬었다가 재시도
    if (attempt === attempts) throw new Error(`${response.status} ${response.statusText}: ${url}`);
    await sleep(5000 * attempt);
  }
  throw new Error('unreachable');
}

type CategoryMembersResponse = {
  continue?: { cmcontinue: string };
  query?: { categorymembers?: Array<{ title: string }> };
};

async function fetchWiktionaryCategory(category: string): Promise<string[]> {
  const titles: string[] = [];
  let cmcontinue: string | undefined;
  do {
    const query = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: `분류:${category}`,
      cmlimit: '500',
      cmnamespace: '0',
      format: 'json',
      ...(cmcontinue ? { cmcontinue } : {}),
    });
    const data = await fetchJson<CategoryMembersResponse>(`https://ko.wiktionary.org/w/api.php?${query}`);
    titles.push(...(data.query?.categorymembers ?? []).map(member => member.title));
    cmcontinue = data.continue?.cmcontinue;
  } while (cmcontinue);
  return titles;
}

async function importProverbs(): Promise<WordEntry[]> {
  const titles = await fetchWiktionaryCategory('한국어 속담');
  return titles.flatMap(title => {
    const word = normalizeWord(title);
    return word ? [{ word, category: 'PROVERB' as const }] : [];
  });
}

async function importIdioms(): Promise<WordEntry[]> {
  const titles = await fetchWiktionaryCategory('한국어 한자성어');
  // 사자성어는 한글 4음절만 사용 (한자 표기·긴 풀이형 표제어 제외)
  return titles.filter(title => /^[가-힣]{4}$/u.test(title)).map(word => ({ word, category: 'IDIOM' as const }));
}

type SparqlResponse = { results: { bindings: Array<{ l: { value: string } }> } };

async function fetchWikidataLabels(where: string, minSitelinks: number, limit: number): Promise<string[]> {
  const sparql = `SELECT ?l WHERE { ${where} ?f wikibase:sitelinks ?sl . FILTER(?sl >= ${minSitelinks}) ?f rdfs:label ?l . FILTER(LANG(?l) = "ko") } ORDER BY DESC(?sl) LIMIT ${limit}`;
  const query = new URLSearchParams({ format: 'json', query: sparql });
  const data = await fetchJson<SparqlResponse>(`https://query.wikidata.org/sparql?${query}`);
  return data.results.bindings.map(binding => binding.l.value);
}

// 속편·부제가 붙은 제목은 통째로 제외한다 ("어벤져스: 엔드게임", "브레이킹 던 part 2" 등) - 정확한 원제만 쓴다
const SEQUEL_OR_SUBTITLE =
  /[:：\-–—~]|\d+$|\bpart\b|파트|시즌|에피소드|챕터|[ⅠⅡⅢⅣⅤⅥ]|\s(?:II|III|IV|V|VI)$|\s(?:더 무비|극장판)$/iu;

function normalizeTitle(raw: string): string | null {
  const withoutNote = raw
    .replace(/\([^)]*\)/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (SEQUEL_OR_SUBTITLE.test(withoutNote)) return null;
  return normalizeWord(withoutNote);
}

async function importMovies(): Promise<WordEntry[]> {
  const labels = await fetchWikidataLabels('?f wdt:P31 wd:Q11424 .', MOVIE_MIN_SITELINKS, 1500);
  return labels.flatMap(label => {
    const word = normalizeTitle(label);
    return word ? [{ word, category: 'MOVIE' as const }] : [];
  });
}

async function importDramas(): Promise<WordEntry[]> {
  const labels = await fetchWikidataLabels('?f wdt:P31 wd:Q5398426 ; wdt:P495 wd:Q884 .', DRAMA_MIN_SITELINKS, 800);
  return labels.flatMap(label => {
    const word = normalizeTitle(label);
    return word ? [{ word, category: 'DRAMA' as const }] : [];
  });
}

const normalizeKey = (word: string): string => word.replace(/\s/gu, '');

// 검수 목록은 사람이 확인한 그대로 쓴다 — 자동 정규화(최소 2자 등)를 거치면 곰·말·별·산 같은 한 글자 단어가 빠진다
async function importCurated(category: Category, file: string): Promise<WordEntry[]> {
  return (await readCuratedList(file)).flatMap(item => {
    const word = item.trim();
    return word ? [{ word, category }] : [];
  });
}

// 검수 목록끼리 같은 단어(공백 무시)가 있으면 어느 카테고리인지 정할 수 없으므로 적재 전에 중단한다
function assertDisjoint(curated: Array<[Category, WordEntry[]]>): void {
  const owner = new Map<string, Category>();
  const conflicts: string[] = [];
  for (const [category, entries] of curated) {
    for (const { word } of entries) {
      const key = normalizeKey(word);
      const existing = owner.get(key);
      if (existing && existing !== category) conflicts.push(`${word} (${existing}, ${category})`);
      owner.set(key, category);
    }
  }
  if (conflicts.length > 0) throw new Error(`검수 목록 간 중복 단어: ${conflicts.join(', ')}`);
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

// 공개 소스 — 소스가 기준이라 빠진 단어는 지우되, 응답이 비정상적으로 적으면 삭제 없이 건너뛴다.
// 다른 카테고리에 이미 있는 단어(공백 무시)는 넣지 않는다.
async function syncSource(category: Category, entries: WordEntry[]): Promise<void> {
  const others = await prisma.wordPool.findMany({ where: { category: { not: category } }, select: { word: true } });
  const taken = new Set(others.map(o => normalizeKey(o.word)));
  const accepted = entries.filter(e => !taken.has(normalizeKey(e.word)));
  const skipped = entries.filter(e => taken.has(normalizeKey(e.word))).map(e => e.word);
  if (skipped.length > 0) console.log(`[words] ${category}: 다른 카테고리와 겹쳐 제외 - ${skipped.join(', ')}`);

  const existing = await prisma.wordPool.count({ where: { category } });
  if (accepted.length === 0 || accepted.length < existing * MIN_KEEP_RATIO) {
    console.warn(
      `[words] ${category}: 소스 ${accepted.length}개 < 기존 ${existing}개의 ${MIN_KEEP_RATIO * 100}% - 건너뜀`,
    );
    return;
  }
  const removed = await prisma.wordPool.deleteMany({
    where: { category, word: { notIn: accepted.map(e => e.word) } },
  });
  if (removed.count > 0) console.log(`[words] ${category}: 소스에서 빠진 ${removed.count}개 제거`);
  await save(category, accepted);
}

async function main(): Promise<void> {
  const curated = await Promise.all(
    CURATED_FILES.map(
      async ([category, file]) => [category, await importCurated(category, file)] as [Category, WordEntry[]],
    ),
  );
  assertDisjoint(curated);
  // 검수 목록을 먼저 반영해야 소스 단어의 카테고리 겹침을 목록 기준으로 거를 수 있다
  for (const [category, entries] of curated) await syncCurated(category, entries);

  await syncSource('PROVERB', await importProverbs());
  await syncSource('IDIOM', await importIdioms());
  await syncSource('MOVIE', await importMovies());
  await syncSource('DRAMA', await importDramas());
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
