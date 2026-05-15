// 캐릭터 ID 풀 — 동물 10종 + 과일 10종 (DEVELOPER.md §3, AUTH-03)
// 실제 이미지 에셋은 apps/mobile/assets/characters/{id}.png에 대응
export const CHARACTER_IDS = [
  // 동물 10
  'dog', 'cat', 'rabbit', 'bear', 'fox',
  'panda', 'lion', 'tiger', 'penguin', 'koala',
  // 과일 10
  'apple', 'banana', 'grape', 'lemon', 'orange',
  'strawberry', 'watermelon', 'peach', 'pineapple', 'cherry',
] as const;

export type CharacterId = (typeof CHARACTER_IDS)[number];

export function isValidCharacterId(id: string): id is CharacterId {
  return (CHARACTER_IDS as readonly string[]).includes(id);
}
