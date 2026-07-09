// 캐릭터 ID 풀 — 동물 10종 + 과일 10종
// 실제 이미지 에셋은 apps/mobile/assets/characters/{id}.png에 대응
export const CHARACTER_IDS = [
  // 과일 10
  'apple', 'banana', 'strawberry', 'grape', 'orange',
  'pineapple', 'watermelon', 'cherry', 'lemon', 'blueberry',
  // 동물 10
  'bear', 'cat', 'dog', 'pig', 'frog',
  'duck', 'turtle', 'rabbit', 'fox', 'chicken',
] as const;

export type CharacterId = (typeof CHARACTER_IDS)[number];

export function isValidCharacterId(id: string): id is CharacterId {
  return (CHARACTER_IDS as readonly string[]).includes(id);
}
