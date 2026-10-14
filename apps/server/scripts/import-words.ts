import { readFile } from 'node:fs/promises';
import { PrismaClient, type Category } from '@prisma/client';

// 제시어 풀 적재 스크립트 - 외부 호출은 이 스크립트에서만 하고, 게임 서버는 DB(WordPool)만 읽는다.
// API 키가 필요 없는 공개 소스만 쓴다 (모두 상업적 이용 가능한 라이선스).
//   한국어 위키낱말사전 분류 (CC BY-SA 4.0): 동물, 음식, 사물, 자연, 장소, 직업, 속담, 사자성어
//   Wikidata (CC0): 영화, 드라마, 행동(스포츠)
//   MEME: prisma/words/meme.json 큐레이션 목록 (공개 위키에 최신 밈이 없어 직접 관리)
// 이미 있는 단어는 건너뛰므로 여러 번 실행해도 안전하다. 월 1회 크론으로 실행하는 것을 전제로 한다.
//
// 기존 7개 카테고리(seed.ts 목록 포함)는 추가만 하고 삭제하지 않는다.
// 신규 5개 카테고리는 소스가 기준이라 소스에서 빠진 단어를 지우되, 가져온 개수가 기존의 절반 미만이면
// (위키 장애·빈 응답 등) 삭제 없이 건너뛴다.

const prisma = new PrismaClient();

const USER_AGENT = 'SketchCatchWordImporter/1.0 (hobby project; word pool import)';
const MIN_LENGTH = 2;
const MAX_LENGTH = 20; // 커스텀 제시어 최대 길이와 동일
const REQUEST_GAP_MS = 1000; // 위키미디어 서버에 부담을 주지 않도록 요청 간격을 둔다
const MOVIE_MIN_SITELINKS = 45;
const DRAMA_MIN_SITELINKS = 4;
const SPORT_MIN_SITELINKS = 30;
// 소스에서 가져온 개수가 기존 개수의 이 비율 미만이면 정리(삭제)를 건너뛴다
const MIN_KEEP_RATIO = 0.5;
// 위키낱말사전 표제어는 공백 없는 한글 단어만 사용 (뜻풀이형 문구·외국어 표기 제외)
const PLAIN_HANGUL_WORD = /^[가-힣]{2,8}$/u;

// 카테고리별 위키낱말사전 분류 (분류명에서 '한국어 ' 접두사 뒤 이름)
const WIKTIONARY_CATEGORIES: Partial<Record<Category, string[]>> = {
  ANIMAL: ['동물', '포유류', '조류', '어류', '곤충', '갑각류', '파충류', '양서류'],
  FOOD: ['음식'],
  NATURE: ['식물', '나무', '광물', '암석', '날씨', '천체', '지형'],
  PLACE: ['국명', '도시', '수도', '건축물'],
  JOB: ['직업'],
  OBJECT: ['의류', '도구', '악기', '가구', '주방용품', '탈것', '장신구', '스포츠용품', '선박'],
};
// 위키낱말사전 표제어는 희귀어(학명·외국 소도시·옛말)가 많아, Wikidata 문서가 여러 언어로 있는(=널리 알려진) 단어만 쓴다.
// 값은 카테고리별 최소 언어판 수 - 도시·지명은 알려진 곳만 남기려고 더 높게 잡는다.
const MIN_SITELINKS_BY_CATEGORY: Partial<Record<Category, number>> = {
  ANIMAL: 30,
  FOOD: 20,
  OBJECT: 25,
  NATURE: 40,
  PLACE: 60,
  JOB: 15,
};
const SITELINK_CHUNK_SIZE = 120;
// 추가만 하는(삭제하지 않는) 기존 카테고리
const ADDITIVE_ONLY: Category[] = ['ANIMAL', 'FOOD', 'OBJECT', 'NATURE', 'PLACE', 'ACTION', 'JOB'];

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

// 한국어 라벨이 같은 Wikidata 항목의 언어판 수(최대값). 동음이의어는 가장 유명한 항목 기준이라 완벽하진 않다.
async function fetchSitelinkCounts(words: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (let i = 0; i < words.length; i += SITELINK_CHUNK_SIZE) {
    const values = words
      .slice(i, i + SITELINK_CHUNK_SIZE)
      .map(word => `"${word.replace(/["\\]/gu, '')}"@ko`)
      .join(' ');
    const sparql = `SELECT ?l (MAX(?sl) AS ?m) WHERE { VALUES ?l { ${values} } ?f rdfs:label ?l ; wikibase:sitelinks ?sl } GROUP BY ?l`;
    const data = await fetchJson<{ results: { bindings: Array<{ l: { value: string }; m: { value: string } }> } }>(
      'https://query.wikidata.org/sparql',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query: sparql }),
      },
    );
    for (const binding of data.results.bindings) counts.set(binding.l.value, Number(binding.m.value));
  }
  return counts;
}

async function importWiktionary(category: Category, names: string[]): Promise<WordEntry[]> {
  const entries: WordEntry[] = [];
  for (const name of names) {
    const titles = await fetchWiktionaryCategory(`한국어 ${name}`);
    for (const title of titles) if (PLAIN_HANGUL_WORD.test(title)) entries.push({ word: title, category });
  }
  const minSitelinks = MIN_SITELINKS_BY_CATEGORY[category] ?? 0;
  if (minSitelinks === 0) return entries;
  const counts = await fetchSitelinkCounts([...new Set(entries.map(e => e.word))]);
  return entries.filter(e => (counts.get(e.word) ?? 0) >= minSitelinks);
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

async function importSports(): Promise<WordEntry[]> {
  const labels = await fetchWikidataLabels('?f wdt:P31 wd:Q31629 .', SPORT_MIN_SITELINKS, 300);
  return labels.flatMap(label => (PLAIN_HANGUL_WORD.test(label) ? [{ word: label, category: 'ACTION' as const }] : []));
}

async function importMemes(): Promise<WordEntry[]> {
  const raw = JSON.parse(await readFile(new URL('../prisma/words/meme.json', import.meta.url), 'utf8')) as string[];
  return raw.flatMap(item => {
    const word = normalizeWord(item);
    return word ? [{ word, category: 'MEME' as const }] : [];
  });
}

async function save(label: Category, entries: WordEntry[]): Promise<void> {
  const unique = [...new Map(entries.map(e => [e.word, e])).values()];
  const result = await prisma.wordPool.createMany({
    data: unique.map(({ word, category }) => ({ word, category, length: word.length })),
    skipDuplicates: true,
  });
  console.log(`[words] ${label}: 후보 ${unique.length}개 중 ${result.count}개 추가`);
}

// 신규 카테고리는 소스가 유일한 기준 - 소스에서 빠진(또는 규칙에 안 맞게 된) 단어는 풀에서도 제거한다.
// 기존 카테고리(ADDITIVE_ONLY)는 추가만 한다. 소스 응답이 비정상적으로 적으면 삭제 없이 건너뛴다.
async function sync(category: Category, entries: WordEntry[]): Promise<void> {
  if (ADDITIVE_ONLY.includes(category)) {
    await save(category, entries);
    return;
  }
  const existing = await prisma.wordPool.count({ where: { category } });
  if (entries.length === 0 || entries.length < existing * MIN_KEEP_RATIO) {
    console.warn(
      `[words] ${category}: 소스 ${entries.length}개 < 기존 ${existing}개의 ${MIN_KEEP_RATIO * 100}% - 건너뜀`,
    );
    return;
  }
  const removed = await prisma.wordPool.deleteMany({
    where: { category, word: { notIn: entries.map(e => e.word) } },
  });
  if (removed.count > 0) console.log(`[words] ${category}: 소스에서 빠진 ${removed.count}개 제거`);
  await save(category, entries);
}

async function main(): Promise<void> {
  await sync('MEME', await importMemes());
  await sync('PROVERB', await importProverbs());
  await sync('IDIOM', await importIdioms());
  await sync('MOVIE', await importMovies());
  await sync('DRAMA', await importDramas());
  for (const [category, names] of Object.entries(WIKTIONARY_CATEGORIES) as Array<[Category, string[]]>) {
    await sync(category, await importWiktionary(category, names));
  }
  await sync('ACTION', await importSports());
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
