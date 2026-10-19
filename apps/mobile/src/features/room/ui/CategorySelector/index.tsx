import { ScrollView } from 'dripsy';
import type { Category } from '@sketch-catch/shared';
import { CategoryChip } from '../CategoryChip';
import { spacing } from '@/shared/config';

// 가나다순: 동물·드라마·밈·사물·사자성어·속담·영화·음식·자연·장소·직업·행동
export const ALL_CATEGORIES: Category[] = [
  'ANIMAL',
  'DRAMA',
  'MEME',
  'OBJECT',
  'IDIOM',
  'PROVERB',
  'MOVIE',
  'FOOD',
  'NATURE',
  'PLACE',
  'JOB',
  'ACTION',
];

const CATEGORY_LABEL: Record<Category, string> = {
  ANIMAL: '동물', OBJECT: '사물', FOOD: '음식', NATURE: '자연', PLACE: '장소', JOB: '직업', ACTION: '행동',
  PROVERB: '속담', IDIOM: '사자성어', MOVIE: '영화', DRAMA: '드라마', MEME: '밈', CUSTOM: '커스텀',
};

type Props = {
  value: Category[];
  onChange: (categories: Category[]) => void;
};

export function CategorySelector({ value, onChange }: Props) {
  const isAllSelected = ALL_CATEGORIES.every((cat) => value.includes(cat));

  // 카테고리는 최소 1개 — 전체 해제 시 비우지 않고 첫 카테고리(동물)만 남긴다
  const toggleAll = (): void => {
    onChange(isAllSelected ? [ALL_CATEGORIES[0]!] : ['CUSTOM', ...ALL_CATEGORIES]);
  };

  const toggleCategory = (cat: Category): void => {
    if (value.includes(cat)) {
      if (value.length === 1) return;
      onChange(value.filter((c) => c !== cat));
    } else {
      onChange([...value, cat]);
    }
  };

  const toggleCustom = (): void => {
    if (value.includes('CUSTOM')) {
      if (value.length === 1) return;
      onChange(value.filter((c) => c !== 'CUSTOM'));
    } else {
      onChange([...value, 'CUSTOM']);
    }
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.SM, paddingRight: spacing.MD }}>
      <CategoryChip label="전체" active={isAllSelected} onPress={toggleAll} />
      <CategoryChip label="커스텀" active={value.includes('CUSTOM')} onPress={toggleCustom} />
      {ALL_CATEGORIES.map((cat) => (
        <CategoryChip key={cat} label={CATEGORY_LABEL[cat]} active={value.includes(cat)} onPress={() => toggleCategory(cat)} />
      ))}
    </ScrollView>
  );
}
