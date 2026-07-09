import { CHARACTER_IDS as SHARED_CHARACTER_IDS, type CharacterId } from '@sketch-catch/shared';
import { characters as characterImages } from './assets';

export const CHARACTER_IDS = SHARED_CHARACTER_IDS;
export type { CharacterId };

export function getCharacterImageSource(id: string): number | null {
  return (characterImages as Record<string, number | undefined>)[id] ?? null;
}
