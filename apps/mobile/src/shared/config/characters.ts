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
  // 과일 10
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
  // 동물 10
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
};

const FALLBACK_COLOR = { main: '#C0B4D8', snout: '#8F82AD' } as const;

export function getCharacterColor(id: string): { main: string; snout: string } {
  return CHARACTER_COLORS[id] ?? FALLBACK_COLOR;
}
