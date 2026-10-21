import { CHARACTER_IDS as SHARED_CHARACTER_IDS, type CharacterId } from '@sketch-catch/shared';
import { characters as characterImages } from './assets';

export const CHARACTER_IDS = SHARED_CHARACTER_IDS;
export type { CharacterId };

export function getCharacterImageSource(id: string): number | null {
  return (characterImages as Record<string, number | undefined>)[id] ?? null;
}

/**
 * 캐릭터별 대표색. 채팅 스트림 말풍선의 스피커 색 칩 등에 사용.
 * `main`은 칩 배경, `snout`은 테두리/그림자용 어두운 변형.
 */
export const CHARACTER_COLORS: Record<string, { main: string; snout: string }> = {
  // 기존 과일
  apple: { main: '#FF6B6B', snout: '#D64545' },
  banana: { main: '#FFE066', snout: '#D6B94F' },
  strawberry: { main: '#FF7BA3', snout: '#E0567F' },
  grape: { main: '#B18AF0', snout: '#8F66D1' },
  orange: { main: '#FF9F5A', snout: '#E07A3A' },
  pineapple: { main: '#FFD24F', snout: '#D6A82F' },
  watermelon: { main: '#7FD98F', snout: '#4FB86A' },
  cherry: { main: '#FF5C7A', snout: '#E0405C' },
  lemon: { main: '#F5E07A', snout: '#D6BD4F' },
  blueberry: { main: '#7FA0E0', snout: '#5876C4' },
  // 기존 동물
  bear: { main: '#C9A27E', snout: '#A67F5C' },
  cat: { main: '#F2A0BC', snout: '#D97D9D' },
  dog: { main: '#E8C58A', snout: '#C8A065' },
  pig: { main: '#FFB3C7', snout: '#E088A0' },
  frog: { main: '#8AD98A', snout: '#5FB45F' },
  duck: { main: '#FFDE6B', snout: '#D6B94F' },
  turtle: { main: '#8AD7C0', snout: '#5FB49B' },
  rabbit: { main: '#E8DFE8', snout: '#B8AAC4' },
  fox: { main: '#FF9564', snout: '#E0703F' },
  chicken: { main: '#FFE0A0', snout: '#D6B870' },
  // 신규 캐릭터 25종
  peach: { main: '#F6AEAE', snout: '#D87B89' },
  lychee: { main: '#F1809F', snout: '#B94C69' },
  mango: { main: '#FFC15A', snout: '#DA8B37' },
  durian: { main: '#BBC83D', snout: '#818E29' },
  kiwi: { main: '#ADCB77', snout: '#849A47' },
  raccoon: { main: '#B3A18F', snout: '#72655B' },
  squirrel: { main: '#D99761', snout: '#A76A42' },
  otter: { main: '#B58567', snout: '#815A44' },
  penguin: { main: '#8E94A4', snout: '#535968' },
  shark: { main: '#9ABBD8', snout: '#6285AB' },
  potato: { main: '#DCBC7F', snout: '#B28C53' },
  sweetpotato: { main: '#C77399', snout: '#934467' },
  carrot: { main: '#FFA33C', snout: '#D47425' },
  radish: { main: '#DAE9B3', snout: '#9AB96A' },
  onion: { main: '#EEC589', snout: '#C49656' },
  garlic: { main: '#F2E1CB', snout: '#C5AE92' },
  greenonion: { main: '#A7D77C', snout: '#659843' },
  broccoli: { main: '#78B754', snout: '#437B33' },
  cabbage: { main: '#C3DD91', snout: '#8DA95E' },
  cucumber: { main: '#75B66B', snout: '#3A7E41' },
  tomato: { main: '#FF7C70', snout: '#CB4A44' },
  eggplant: { main: '#AC7AD2', snout: '#75499F' },
  corn: { main: '#FAD454', snout: '#CCA52F' },
  pumpkin: { main: '#F6AE57', snout: '#CD7F30' },
  mushroom: { main: '#F49E8D', snout: '#C46E60' },
};

const FALLBACK_COLOR = { main: '#C0B4D8', snout: '#8F82AD' } as const;

export function getCharacterColor(id: string): { main: string; snout: string } {
  return CHARACTER_COLORS[id] ?? FALLBACK_COLOR;
}
