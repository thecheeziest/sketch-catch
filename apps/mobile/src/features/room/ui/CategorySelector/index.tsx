import { ScrollView, Text, View } from 'dripsy';
import type { Category } from '@sketch-catch/shared';
import { CategoryChip } from '../CategoryChip';
import { colors, spacing } from '@/shared/config';

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

export const CATEGORY_LABEL: Record<Category, string> = {
  ANIMAL: '동물', OBJECT: '사물', FOOD: '음식', NATURE: '자연', PLACE: '장소', JOB: '직업', ACTION: '행동',
  PROVERB: '속담', IDIOM: '사자성어', MOVIE: '영화', DRAMA: '드라마', MEME: '밈', CUSTOM: '커스텀',
};

type Props = {
  value: Category[];
  onChange: (categories: Category[]) => void;
};

export function CategorySelector({ value, onChange }: Props) {
  const isAllSelected = ALL_CATEGORIES.every((cat) => value.includes(cat));

  // 0개도 허용한다 — 빈 선택은 안내 문구로 알리고 저장 버튼은 상위 화면에서 막는다
  const toggleAll = (): void => {
    onChange(isAllSelected ? [] : ['CUSTOM', ...ALL_CATEGORIES]);
  };

  const toggleCategory = (cat: Category): void => {
    if (value.includes(cat)) {
      onChange(value.filter((c) => c !== cat));
    } else {
      onChange([...value, cat]);
    }
  };

  const toggleCustom = (): void => {
    if (value.includes('CUSTOM')) {
      onChange(value.filter((c) => c !== 'CUSTOM'));
    } else {
      onChange([...value, 'CUSTOM']);
    }
  };

  return (
    <View sx={{ gap: spacing.SM }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.SM, paddingRight: spacing.MD }}>
        <CategoryChip label="전체" active={isAllSelected} onPress={toggleAll} />
        <CategoryChip label="커스텀" active={value.includes('CUSTOM')} onPress={toggleCustom} />
        {ALL_CATEGORIES.map((cat) => (
          <CategoryChip key={cat} label={CATEGORY_LABEL[cat]} active={value.includes(cat)} onPress={() => toggleCategory(cat)} />
        ))}
      </ScrollView>
      {value.length === 0 && (
        <Text variant="B4" sx={{ color: colors.ERROR_200 }}>
          하나 이상의 카테고리를 선택해 주세요!
        </Text>
      )}
    </View>
  );
}
