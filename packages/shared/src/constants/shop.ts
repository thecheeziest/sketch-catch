import type { CharacterId } from './characters.js';

// 꾸미기 상점 카탈로그 — 가격·지급량의 진실의 출처. 서버는 이 값으로만 차감·지급하고 클라이언트 값을 믿지 않는다.
// 모든 금액은 5 단위로 맞춘다.

export type ShopCategory = 'CHARACTER' | 'FRAME' | 'BACKGROUND' | 'CHAT_COLOR';

export type FrameDeco = 'CAT_EAR' | 'CROWN' | 'RIBBON' | 'SPROUT';

export type BackgroundPattern = 'CHECK' | 'DOTS' | 'STRIPE' | 'STARS' | 'SUNSET' | 'SPACE';

type ShopItemBase = { id: string; name: string; price: number };

export type CharacterItem = ShopItemBase & { category: 'CHARACTER'; id: CharacterId };
export type FrameItem = ShopItemBase & { category: 'FRAME'; color: string; deco?: FrameDeco };
export type BackgroundItem = ShopItemBase & { category: 'BACKGROUND'; pattern: BackgroundPattern };
export type ChatColorItem = ShopItemBase & { category: 'CHAT_COLOR'; color: string };

export type ShopItem = CharacterItem | FrameItem | BackgroundItem | ChatColorItem;

export const SHOP_PRICE = {
  CHARACTER: 500,
  FRAME: 200,
  FRAME_SPECIAL: 600,
  BACKGROUND: 300,
  BACKGROUND_SPECIAL: 500,
  CHAT_COLOR: 200,
} as const;

const CHARACTER_NAMES: Record<CharacterId, string> = {
  apple: '사과',
  banana: '바나나',
  strawberry: '딸기',
  grape: '포도',
  orange: '오렌지',
  pineapple: '파인애플',
  watermelon: '수박',
  cherry: '체리',
  lemon: '레몬',
  blueberry: '블루베리',
  bear: '곰',
  cat: '고양이',
  dog: '강아지',
  pig: '돼지',
  frog: '개구리',
  duck: '오리',
  turtle: '거북이',
  rabbit: '토끼',
  fox: '여우',
  chicken: '병아리',
};

const CHARACTER_ITEMS: CharacterItem[] = (Object.keys(CHARACTER_NAMES) as CharacterId[]).map(id => ({
  id,
  category: 'CHARACTER',
  name: CHARACTER_NAMES[id],
  price: SHOP_PRICE.CHARACTER,
}));

const FRAME_ITEMS: FrameItem[] = [
  { id: 'frame_pink', category: 'FRAME', name: '핑크 테두리', price: SHOP_PRICE.FRAME, color: '#FF88BB' },
  { id: 'frame_mint', category: 'FRAME', name: '민트 테두리', price: SHOP_PRICE.FRAME, color: '#08EC7B' },
  { id: 'frame_gold', category: 'FRAME', name: '골드 테두리', price: SHOP_PRICE.FRAME, color: '#FFCC00' },
  { id: 'frame_sky', category: 'FRAME', name: '하늘 테두리', price: SHOP_PRICE.FRAME, color: '#77AAFF' },
  { id: 'frame_orange', category: 'FRAME', name: '오렌지 테두리', price: SHOP_PRICE.FRAME, color: '#FF9F5A' },
  { id: 'frame_lavender', category: 'FRAME', name: '라벤더 테두리', price: SHOP_PRICE.FRAME, color: '#BB77FF' },
  { id: 'frame_red', category: 'FRAME', name: '빨강 테두리', price: SHOP_PRICE.FRAME, color: '#FF3322' },
  { id: 'frame_white', category: 'FRAME', name: '하양 테두리', price: SHOP_PRICE.FRAME, color: '#FAFAFA' },
  { id: 'frame_cat_ear', category: 'FRAME', name: '고양이 귀', price: SHOP_PRICE.FRAME_SPECIAL, color: '#FF88BB', deco: 'CAT_EAR' },
  { id: 'frame_crown', category: 'FRAME', name: '왕관', price: SHOP_PRICE.FRAME_SPECIAL, color: '#FFCC00', deco: 'CROWN' },
  { id: 'frame_ribbon', category: 'FRAME', name: '리본', price: SHOP_PRICE.FRAME_SPECIAL, color: '#FF3388', deco: 'RIBBON' },
  { id: 'frame_sprout', category: 'FRAME', name: '새싹', price: SHOP_PRICE.FRAME_SPECIAL, color: '#72E0A2', deco: 'SPROUT' },
];

const BACKGROUND_ITEMS: BackgroundItem[] = [
  { id: 'bg_check', category: 'BACKGROUND', name: '체크', price: SHOP_PRICE.BACKGROUND, pattern: 'CHECK' },
  { id: 'bg_dots', category: 'BACKGROUND', name: '핑크 도트', price: SHOP_PRICE.BACKGROUND, pattern: 'DOTS' },
  { id: 'bg_stripe', category: 'BACKGROUND', name: '줄무늬', price: SHOP_PRICE.BACKGROUND, pattern: 'STRIPE' },
  { id: 'bg_stars', category: 'BACKGROUND', name: '별밤', price: SHOP_PRICE.BACKGROUND_SPECIAL, pattern: 'STARS' },
  { id: 'bg_sunset', category: 'BACKGROUND', name: '노을', price: SHOP_PRICE.BACKGROUND_SPECIAL, pattern: 'SUNSET' },
  { id: 'bg_space', category: 'BACKGROUND', name: '우주', price: SHOP_PRICE.BACKGROUND_SPECIAL, pattern: 'SPACE' },
];

// 어두운 채팅 말풍선 위에서 대비 4.5:1 이상인 색만 판매한다
const CHAT_COLOR_ITEMS: ChatColorItem[] = [
  { id: 'chat_pink', category: 'CHAT_COLOR', name: '핑크', price: SHOP_PRICE.CHAT_COLOR, color: '#FF88BB' },
  { id: 'chat_mint', category: 'CHAT_COLOR', name: '민트', price: SHOP_PRICE.CHAT_COLOR, color: '#08EC7B' },
  { id: 'chat_sky', category: 'CHAT_COLOR', name: '하늘', price: SHOP_PRICE.CHAT_COLOR, color: '#77AAFF' },
  { id: 'chat_yellow', category: 'CHAT_COLOR', name: '노랑', price: SHOP_PRICE.CHAT_COLOR, color: '#FFEE66' },
  { id: 'chat_lavender', category: 'CHAT_COLOR', name: '라벤더', price: SHOP_PRICE.CHAT_COLOR, color: '#BB77FF' },
  { id: 'chat_orange', category: 'CHAT_COLOR', name: '오렌지', price: SHOP_PRICE.CHAT_COLOR, color: '#FF9F5A' },
  { id: 'chat_lime', category: 'CHAT_COLOR', name: '라임', price: SHOP_PRICE.CHAT_COLOR, color: '#66FF99' },
  { id: 'chat_coral', category: 'CHAT_COLOR', name: '코랄', price: SHOP_PRICE.CHAT_COLOR, color: '#FF7766' },
];

export const SHOP_ITEMS: readonly ShopItem[] = [...CHARACTER_ITEMS, ...FRAME_ITEMS, ...BACKGROUND_ITEMS, ...CHAT_COLOR_ITEMS];

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
