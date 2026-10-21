import { CHARACTER_IDS, type CharacterId } from './characters.js';

// 꾸미기 상점 카탈로그 — 가격·지급량의 진실의 출처. 서버는 이 값으로만 차감·지급하고 클라이언트 값을 믿지 않는다.
// 모든 금액은 5 단위로 맞춘다.

export type ShopCategory = 'CHARACTER' | 'FRAME' | 'BACKGROUND' | 'CHAT_COLOR';

export type FrameDeco = 'CAT_EAR' | 'DOG_EAR' | 'BEAR_EAR' | 'CROWN' | 'RIBBON' | 'SPROUT';

export const SHOP_RARITIES = ['COMMON', 'RARE', 'LEGENDARY'] as const;
export type ShopRarity = (typeof SHOP_RARITIES)[number];
export const SHOP_RARITY_NAMES: Record<ShopRarity, string> = { COMMON: '일반', RARE: '희귀', LEGENDARY: '전설' };

export const COSMETIC_ARTWORKS = [
  'strawberry',
  'peach',
  'candy',
  'sketch',
  'coin',
  'clover',
  'soda',
  'ocean',
  'moon',
  'desktop',
  'arcade',
  'rainbow',
] as const;
export type CosmeticArtwork = (typeof COSMETIC_ARTWORKS)[number];

export type BackgroundPattern = 'SOLID' | 'CHECK' | 'DOTS' | 'STRIPE' | 'STARS' | 'POLKA' | 'BURST';

type ShopItemBase = { id: string; name: string; price: number; rarity: ShopRarity };

export type CharacterItem = ShopItemBase & { category: 'CHARACTER'; id: CharacterId };
export type FrameItem = ShopItemBase & {
  category: 'FRAME';
  color: string;
  deco?: FrameDeco;
  artwork?: CosmeticArtwork;
};
export type BackgroundItem = ShopItemBase & { category: 'BACKGROUND' } & (
    | { pattern: 'SOLID'; color: string; artwork?: never }
    | { pattern: Exclude<BackgroundPattern, 'SOLID'>; color?: never; artwork?: never }
    | { artwork: CosmeticArtwork; pattern?: never; color?: never }
  );
export type ChatColorItem = ShopItemBase & {
  category: 'CHAT_COLOR';
  color: string;
  /** 일반 글꼴 위에 바깥 외곽선부터 순서대로 겹친다. 단위는 논리 픽셀. */
  outlines?: readonly { color: string; width: number }[];
  shadows?: readonly { color: string; x: number; y: number; blur?: number }[];
  bands?: readonly string[];
  hollow?: boolean;
};

export type ShopItem = CharacterItem | FrameItem | BackgroundItem | ChatColorItem;

export const SHOP_PRICE = {
  CHARACTER: 500,
  FRAME: 200,
  FRAME_SPECIAL: 600,
  BACKGROUND: 300,
  BACKGROUND_SPECIAL: 500,
  CHAT_COLOR: 200,
  LEGENDARY: 2000,
} as const;

const CHARACTER_NAMES: Record<CharacterId, string> = {
  apple: '사과',
  strawberry: '딸기',
  cherry: '체리',
  orange: '오렌지',
  lemon: '레몬',
  banana: '바나나',
  pineapple: '파인애플',
  watermelon: '수박',
  grape: '포도',
  blueberry: '블루베리',
  cat: '고양이',
  dog: '강아지',
  fox: '여우',
  bear: '곰',
  pig: '돼지',
  rabbit: '토끼',
  frog: '개구리',
  turtle: '거북이',
  duck: '오리',
  chicken: '닭',
  peach: '복숭아',
  lychee: '리치',
  mango: '망고',
  durian: '두리안',
  kiwi: '키위',
  raccoon: '너구리',
  squirrel: '다람쥐',
  otter: '수달',
  penguin: '펭귄',
  shark: '상어',
  potato: '감자',
  sweetpotato: '고구마',
  carrot: '당근',
  radish: '무',
  onion: '양파',
  garlic: '마늘',
  greenonion: '대파',
  broccoli: '브로콜리',
  cabbage: '양배추',
  cucumber: '오이',
  tomato: '토마토',
  eggplant: '가지',
  corn: '옥수수',
  pumpkin: '호박',
  mushroom: '버섯',
};

const CHARACTER_ITEMS: CharacterItem[] = CHARACTER_IDS.map(id => ({
  id,
  category: 'CHARACTER',
  name: CHARACTER_NAMES[id],
  price: SHOP_PRICE.CHARACTER,
  rarity: 'COMMON',
}));

// 이전 라벤더·하양 id는 보유 아이템 호환성을 위해 유지하고 외형·이름만 갱신한다.
const FRAME_ITEMS: FrameItem[] = [
  {
    id: 'frame_white',
    category: 'FRAME',
    name: '실버 테두리',
    rarity: 'COMMON',
    price: SHOP_PRICE.FRAME,
    color: '#B8C6D9',
  },
  {
    id: 'frame_gold',
    category: 'FRAME',
    name: '골드 테두리',
    rarity: 'COMMON',
    price: SHOP_PRICE.FRAME,
    color: '#FFCC00',
  },
  {
    id: 'frame_lavender',
    category: 'FRAME',
    name: '검정 테두리',
    rarity: 'COMMON',
    price: SHOP_PRICE.FRAME,
    color: '#111118',
  },
  {
    id: 'frame_orange',
    category: 'FRAME',
    name: '오렌지 테두리',
    rarity: 'COMMON',
    price: SHOP_PRICE.FRAME,
    color: '#FF9F5A',
  },
  {
    id: 'frame_pink',
    category: 'FRAME',
    name: '핑크 테두리',
    rarity: 'COMMON',
    price: SHOP_PRICE.FRAME,
    color: '#FF88BB',
  },
  {
    id: 'frame_red',
    category: 'FRAME',
    name: '빨강 테두리',
    rarity: 'COMMON',
    price: SHOP_PRICE.FRAME,
    color: '#FF3322',
  },
  {
    id: 'frame_sky',
    category: 'FRAME',
    name: '하늘 테두리',
    rarity: 'COMMON',
    price: SHOP_PRICE.FRAME,
    color: '#77AAFF',
  },
  {
    id: 'frame_aqua',
    category: 'FRAME',
    name: '아쿠아 테두리',
    rarity: 'COMMON',
    price: SHOP_PRICE.FRAME,
    color: '#53D8E8',
  },
  {
    id: 'frame_mint',
    category: 'FRAME',
    name: '민트 테두리',
    rarity: 'COMMON',
    price: SHOP_PRICE.FRAME,
    color: '#08EC7B',
  },
  {
    id: 'frame_cat_ear',
    category: 'FRAME',
    name: '고양이 귀',
    rarity: 'RARE',
    price: SHOP_PRICE.FRAME_SPECIAL,
    color: '#FF88BB',
    deco: 'CAT_EAR',
  },
  {
    id: 'frame_star',
    category: 'FRAME',
    name: '강아지 귀',
    rarity: 'RARE',
    price: SHOP_PRICE.FRAME_SPECIAL,
    color: '#F9DF84',
    deco: 'DOG_EAR',
  },
  {
    id: 'frame_moon',
    category: 'FRAME',
    name: '곰돌이 귀',
    rarity: 'RARE',
    price: SHOP_PRICE.FRAME_SPECIAL,
    color: '#C99872',
    deco: 'BEAR_EAR',
  },
  {
    id: 'frame_crown',
    category: 'FRAME',
    name: '왕관',
    rarity: 'RARE',
    price: SHOP_PRICE.FRAME_SPECIAL,
    color: '#FFCC00',
    deco: 'CROWN',
  },
  {
    id: 'frame_ribbon',
    category: 'FRAME',
    name: '리본',
    rarity: 'RARE',
    price: SHOP_PRICE.FRAME_SPECIAL,
    color: '#FF3388',
    deco: 'RIBBON',
  },
  {
    id: 'frame_sprout',
    category: 'FRAME',
    name: '새싹',
    rarity: 'RARE',
    price: SHOP_PRICE.FRAME_SPECIAL,
    color: '#72E0A2',
    deco: 'SPROUT',
  },
  {
    id: 'frame_legend_strawberry',
    category: 'FRAME',
    name: '딸기우유 리본',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#FFC2DA',
    artwork: 'strawberry',
  },
  {
    id: 'frame_legend_peach',
    category: 'FRAME',
    name: '러브레터',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#FFD0A2',
    artwork: 'peach',
  },
  {
    id: 'frame_legend_candy',
    category: 'FRAME',
    name: '별사탕',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#D7BFFC',
    artwork: 'candy',
  },
  {
    id: 'frame_legend_sketch',
    category: 'FRAME',
    name: '스케치 연필',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#FFF1A8',
    artwork: 'sketch',
  },
  {
    id: 'frame_legend_coin',
    category: 'FRAME',
    name: '코인 러시',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#FFE79A',
    artwork: 'coin',
  },
  {
    id: 'frame_legend_clover',
    category: 'FRAME',
    name: '클로버 가든',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#C1E78F',
    artwork: 'clover',
  },
  {
    id: 'frame_legend_soda',
    category: 'FRAME',
    name: '민트 소다',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#ACF3D4',
    artwork: 'soda',
  },
  {
    id: 'frame_legend_ocean',
    category: 'FRAME',
    name: '오션 웨이브',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#A9E5FA',
    artwork: 'ocean',
  },
  {
    id: 'frame_legend_moon',
    category: 'FRAME',
    name: '문라이트',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#E6DEF7',
    artwork: 'moon',
  },
  {
    id: 'frame_legend_desktop',
    category: 'FRAME',
    name: '레트로 윈도',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#C7A0FA',
    artwork: 'desktop',
  },
  {
    id: 'frame_legend_arcade',
    category: 'FRAME',
    name: '네온 아케이드',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#8EE8F1',
    artwork: 'arcade',
  },
  {
    id: 'frame_legend_rainbow',
    category: 'FRAME',
    name: '무지개 보너스',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#F3B4CD',
    artwork: 'rainbow',
  },
];

const BACKGROUND_ITEMS: BackgroundItem[] = [
  {
    id: 'bg_solid_red',
    category: 'BACKGROUND',
    name: '연한 빨강',
    rarity: 'COMMON',
    price: SHOP_PRICE.BACKGROUND,
    pattern: 'SOLID',
    color: '#F4A5A5',
  },
  {
    id: 'bg_solid_pink',
    category: 'BACKGROUND',
    name: '핑크',
    rarity: 'COMMON',
    price: SHOP_PRICE.BACKGROUND,
    pattern: 'SOLID',
    color: '#F8C2DA',
  },
  {
    id: 'bg_solid_yellow',
    category: 'BACKGROUND',
    name: '노랑',
    rarity: 'COMMON',
    price: SHOP_PRICE.BACKGROUND,
    pattern: 'SOLID',
    color: '#FFF0AD',
  },
  {
    id: 'bg_solid_lime',
    category: 'BACKGROUND',
    name: '연두',
    rarity: 'COMMON',
    price: SHOP_PRICE.BACKGROUND,
    pattern: 'SOLID',
    color: '#D5EBA9',
  },
  {
    id: 'bg_solid_sky',
    category: 'BACKGROUND',
    name: '하늘',
    rarity: 'COMMON',
    price: SHOP_PRICE.BACKGROUND,
    pattern: 'SOLID',
    color: '#BEDFF7',
  },
  {
    id: 'bg_solid_black',
    category: 'BACKGROUND',
    name: '블랙',
    rarity: 'COMMON',
    price: SHOP_PRICE.BACKGROUND,
    pattern: 'SOLID',
    color: '#111118',
  },
  {
    id: 'bg_check',
    category: 'BACKGROUND',
    name: '흑백 체크',
    rarity: 'RARE',
    price: SHOP_PRICE.BACKGROUND_SPECIAL,
    pattern: 'CHECK',
  },
  {
    id: 'bg_sunset',
    category: 'BACKGROUND',
    name: '화이트 도트',
    rarity: 'RARE',
    price: SHOP_PRICE.BACKGROUND_SPECIAL,
    pattern: 'POLKA',
  },
  {
    id: 'bg_stars',
    category: 'BACKGROUND',
    name: '별밤',
    rarity: 'RARE',
    price: SHOP_PRICE.BACKGROUND_SPECIAL,
    pattern: 'STARS',
  },
  {
    id: 'bg_dots',
    category: 'BACKGROUND',
    name: '컨페티',
    rarity: 'RARE',
    price: SHOP_PRICE.BACKGROUND_SPECIAL,
    pattern: 'DOTS',
  },
  {
    id: 'bg_stripe',
    category: 'BACKGROUND',
    name: '핑크 레몬 줄무늬',
    rarity: 'RARE',
    price: SHOP_PRICE.BACKGROUND_SPECIAL,
    pattern: 'STRIPE',
  },
  {
    id: 'bg_space',
    category: 'BACKGROUND',
    name: '이목 집중',
    rarity: 'RARE',
    price: SHOP_PRICE.BACKGROUND_SPECIAL,
    pattern: 'BURST',
  },
  {
    id: 'bg_legend_strawberry',
    category: 'BACKGROUND',
    name: '딸기우유 체크',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    artwork: 'strawberry',
  },
  {
    id: 'bg_legend_peach',
    category: 'BACKGROUND',
    name: '복숭아 노을',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    artwork: 'peach',
  },
  {
    id: 'bg_legend_candy',
    category: 'BACKGROUND',
    name: '별사탕 우주',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    artwork: 'candy',
  },
  {
    id: 'bg_legend_sketch',
    category: 'BACKGROUND',
    name: '낙서 노트',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    artwork: 'sketch',
  },
  {
    id: 'bg_legend_coin',
    category: 'BACKGROUND',
    name: '코인 하늘',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    artwork: 'coin',
  },
  {
    id: 'bg_legend_clover',
    category: 'BACKGROUND',
    name: '클로버 들판',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    artwork: 'clover',
  },
  {
    id: 'bg_legend_soda',
    category: 'BACKGROUND',
    name: '소다 구름',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    artwork: 'soda',
  },
  {
    id: 'bg_legend_ocean',
    category: 'BACKGROUND',
    name: '여름 해변',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    artwork: 'ocean',
  },
  {
    id: 'bg_legend_moon',
    category: 'BACKGROUND',
    name: '달빛 호수',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    artwork: 'moon',
  },
  {
    id: 'bg_legend_desktop',
    category: 'BACKGROUND',
    name: '라벤더 데스크톱',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    artwork: 'desktop',
  },
  {
    id: 'bg_legend_arcade',
    category: 'BACKGROUND',
    name: '네온 그리드',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    artwork: 'arcade',
  },
  {
    id: 'bg_legend_rainbow',
    category: 'BACKGROUND',
    name: '보너스 파티',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    artwork: 'rainbow',
  },
];

// 일반 상품은 단색, 전설 상품은 일반 글꼴 위 색·그림자·색 띠 조합이다.
const CHAT_COLOR_ITEMS: ChatColorItem[] = [
  {
    id: 'chat_pink',
    category: 'CHAT_COLOR',
    name: '핑크',
    rarity: 'COMMON',
    price: SHOP_PRICE.CHAT_COLOR,
    color: '#FF88BB',
  },
  {
    id: 'chat_coral',
    category: 'CHAT_COLOR',
    name: '코랄',
    rarity: 'COMMON',
    price: SHOP_PRICE.CHAT_COLOR,
    color: '#FF7766',
  },
  {
    id: 'chat_orange',
    category: 'CHAT_COLOR',
    name: '오렌지',
    rarity: 'COMMON',
    price: SHOP_PRICE.CHAT_COLOR,
    color: '#FF9F5A',
  },
  {
    id: 'chat_yellow',
    category: 'CHAT_COLOR',
    name: '노랑',
    rarity: 'COMMON',
    price: SHOP_PRICE.CHAT_COLOR,
    color: '#FFEE66',
  },
  {
    id: 'chat_lime',
    category: 'CHAT_COLOR',
    name: '라임',
    rarity: 'COMMON',
    price: SHOP_PRICE.CHAT_COLOR,
    color: '#CAEB78',
  },
  {
    id: 'chat_mint',
    category: 'CHAT_COLOR',
    name: '청록',
    rarity: 'COMMON',
    price: SHOP_PRICE.CHAT_COLOR,
    color: '#65DCCE',
  },
  {
    id: 'chat_sky',
    category: 'CHAT_COLOR',
    name: '하늘',
    rarity: 'COMMON',
    price: SHOP_PRICE.CHAT_COLOR,
    color: '#77AAFF',
  },
  {
    id: 'chat_ice',
    category: 'CHAT_COLOR',
    name: '아이스블루',
    rarity: 'COMMON',
    price: SHOP_PRICE.CHAT_COLOR,
    color: '#C0EAF8',
  },
  {
    id: 'chat_lavender',
    category: 'CHAT_COLOR',
    name: '라벤더',
    rarity: 'COMMON',
    price: SHOP_PRICE.CHAT_COLOR,
    color: '#BB77FF',
  },
  {
    id: 'chat_legend_strawberry',
    category: 'CHAT_COLOR',
    name: '딸기크림',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#FFC2DA',
    shadows: [{ color: '#FFE36B', x: 1, y: 1 }],
  },
  {
    id: 'chat_legend_peach',
    category: 'CHAT_COLOR',
    name: '복숭아젤리',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#FFD0A2',
    shadows: [
      { color: '#B83B65', x: 2, y: 2 },
      { color: '#DA637F', x: 1, y: 1 },
    ],
  },
  {
    id: 'chat_legend_candy',
    category: 'CHAT_COLOR',
    name: '별사탕',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#D7BFFC',
    outlines: [
      { color: '#A07AC7', width: 2 },
      { color: '#513477', width: 1 },
    ],
  },
  {
    id: 'chat_legend_sketch',
    category: 'CHAT_COLOR',
    name: '연필레몬',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#FFF1A8',
    outlines: [{ color: '#37B5C4', width: 1 }],
    shadows: [
      { color: '#57E6ED', x: 2, y: 2 },
      { color: '#37B5C4', x: 1, y: 1 },
    ],
  },
  {
    id: 'chat_legend_coin',
    category: 'CHAT_COLOR',
    name: '코인골드',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#FFE79A',
    outlines: [{ color: '#854817', width: 1 }],
    shadows: [
      { color: '#AD641B', x: 1, y: 1 },
      { color: '#FFFFDC', x: -1, y: -1 },
    ],
  },
  {
    id: 'chat_legend_clover',
    category: 'CHAT_COLOR',
    name: '클로버',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#C1E78F',
    outlines: [{ color: '#247C46', width: 1 }],
    shadows: [{ color: '#FFF0AD', x: 1, y: 1 }],
  },
  {
    id: 'chat_legend_soda',
    category: 'CHAT_COLOR',
    name: '민트소다',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#ACF3D4',
    outlines: [{ color: '#176D75', width: 1 }],
    shadows: [{ color: '#29FFF1', x: 0, y: 0, blur: 4 }],
  },
  {
    id: 'chat_legend_ocean',
    category: 'CHAT_COLOR',
    name: '오션블루',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#A9E5FA',
    outlines: [{ color: '#2264CF', width: 1 }],
    shadows: [{ color: '#FFFFFF', x: -1, y: -1 }],
  },
  {
    id: 'chat_legend_moon',
    category: 'CHAT_COLOR',
    name: '문라이트',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#E6DEF7',
    outlines: [{ color: '#8C65D2', width: 1 }],
    shadows: [{ color: '#C1A0FF', x: 0, y: 0, blur: 5 }],
  },
  {
    id: 'chat_legend_desktop',
    category: 'CHAT_COLOR',
    name: '아케이드팝',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#EA91C6',
    outlines: [{ color: '#C54C92', width: 1 }],
    shadows: [{ color: '#FFE56B', x: 1, y: 1 }],
  },
  {
    id: 'chat_legend_arcade',
    category: 'CHAT_COLOR',
    name: '네온듀오',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#8EE8F1',
    outlines: [{ color: '#EC55C9', width: 1 }],
    shadows: [{ color: '#4BA3FF', x: 0, y: 0, blur: 5 }],
    bands: ['#8EE8F1', '#D8C3EE', '#F3AACF'],
  },
  {
    id: 'chat_legend_rainbow',
    category: 'CHAT_COLOR',
    name: '레인보우',
    rarity: 'LEGENDARY',
    price: SHOP_PRICE.LEGENDARY,
    color: '#F3B4CD',
    hollow: true,
    bands: ['#F3B4CD', '#F4CF9F', '#F4E9AB', '#ACDCCA', '#A9D8EE', '#CAB6E6'],
  },
];

export const SHOP_ITEMS: readonly ShopItem[] = [
  ...CHARACTER_ITEMS,
  ...FRAME_ITEMS,
  ...BACKGROUND_ITEMS,
  ...CHAT_COLOR_ITEMS,
];

const SHOP_ITEM_MAP = new Map<string, ShopItem>(SHOP_ITEMS.map(item => [item.id, item]));

export function getShopItem(id: string): ShopItem | undefined {
  return SHOP_ITEM_MAP.get(id);
}

export function getShopItemsByCategory<C extends ShopCategory>(category: C): Extract<ShopItem, { category: C }>[] {
  return SHOP_ITEMS.filter((item): item is Extract<ShopItem, { category: C }> => item.category === category);
}

// ─── 코인 지급 규칙 (하이브리드: 참여 + 정답 + 순위) ───────────────────────────

export const COIN_REWARD = {
  COMPLETE: 10, // 판 끝까지 참여 (모드2는 공개식까지)
  FIRST_GAME_BONUS: 20, // 하루 첫 완주 — 하루 상한에 포함하지 않는다
  MODE1_CORRECT: 5,
  MODE1_CORRECT_MAX: 15,
  MODE1_DRAWING_SOLVED: 5, // 내 그림을 누군가 맞힘 (출제자)
  MODE1_DRAWING_SOLVED_MAX: 15,
  MODE1_RANK: [30, 20, 10] as const, // 1·2·3등
  MODE1_RANK3_MIN_PLAYERS: 4, // 3등 보너스는 4인 이상일 때만
  MODE2_SUBMIT: 5, // 내 단계 직접 제출 (시간 초과 자동 제출 제외)
  MODE2_SUBMIT_MAX: 15,
} as const;

export const COIN_MIN_PLAYERS = 3; // 3인 이상 판만 지급
export const DAILY_COIN_CAP = 400; // 하루 게임 획득 상한 (KST 자정 기준)
export const WELCOME_COINS = 500; // 기능 출시 시 기존 유저 지급
