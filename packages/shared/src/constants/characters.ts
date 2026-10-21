// 캐릭터 분류와 순서의 진실의 출처 — 과일·동물·채소 각 15종.
// 이미지 에셋: mobile/assets/characters 및 server/assets/characters의 동일 ID PNG.
export const CHARACTER_GROUPS = [
  {
    id: 'FRUIT',
    name: '과일',
    ids: [
      'apple',
      'strawberry',
      'cherry',
      'peach',
      'lychee',
      'mango',
      'orange',
      'lemon',
      'banana',
      'pineapple',
      'durian',
      'kiwi',
      'watermelon',
      'grape',
      'blueberry',
    ],
  },
  {
    id: 'ANIMAL',
    name: '동물',
    ids: [
      'cat',
      'dog',
      'fox',
      'raccoon',
      'squirrel',
      'otter',
      'bear',
      'pig',
      'rabbit',
      'duck',
      'chicken',
      'penguin',
      'frog',
      'turtle',
      'shark',
    ],
  },
  {
    id: 'VEGETABLE',
    name: '채소',
    ids: [
      'potato',
      'sweetpotato',
      'carrot',
      'radish',
      'onion',
      'garlic',
      'greenonion',
      'broccoli',
      'cabbage',
      'cucumber',
      'tomato',
      'eggplant',
      'corn',
      'pumpkin',
      'mushroom',
    ],
  },
] as const;

export type CharacterId = (typeof CHARACTER_GROUPS)[number]['ids'][number];
export const CHARACTER_IDS = CHARACTER_GROUPS.flatMap<CharacterId>(group => [...group.ids]);

export function isValidCharacterId(id: string): id is CharacterId {
  return (CHARACTER_IDS as readonly string[]).includes(id);
}
