import { ScrollView } from 'dripsy';
import type { Category } from '@sketch-catch/shared';
import { CategoryChip } from '../CategoryChip';
import { spacing } from '@/shared/config';

// 가나다순: 동물·사물·음식·자연·장소·직업·행동
export const ALL_CATEGORIES: Category[] = ['ANIMAL', 'OBJECT', 'FOOD', 'NATURE', 'PLACE', 'JOB', 'ACTION'];

const CATEGORY_LABEL: Record<Category, string> = {
  ANIMAL: '동물', OBJECT: '사물', FOOD: '음식', NATURE: '자연', PLACE: '장소', JOB: '직업', ACTION: '행동', CUSTOM: '커스텀',
};

type Props = {
  value: Category[];
  onChange: (categories: Category[]) => void;
};

export function CategorySelector({ value, onChange }: Props) {
  const isAllSelected = ALL_CATEGORIES.every((cat) => value.includes(cat));

  const toggleAll = (): void => {
    onChange(isAllSelected ? [] : ['CUSTOM', ...ALL_CATEGORIES]);
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
