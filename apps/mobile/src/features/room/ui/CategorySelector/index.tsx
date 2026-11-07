import { ScrollView, Text, View } from 'dripsy';
import type { Category } from '@sketch-catch/shared';
import { CategoryChip } from '../CategoryChip';
import { colors, spacing } from '@/shared/config';
import { ALL_CATEGORIES, CATEGORY_LABEL } from '@/shared/config/room';
export { ALL_CATEGORIES, CATEGORY_LABEL } from '@/shared/config/room';

type Props = {
  value: Category[];
  onChange: (categories: Category[]) => void;
};

export function CategorySelector({ value, onChange }: Props) {
  const isAllSelected = ALL_CATEGORIES.every((cat) => value.includes(cat));

  // 0개도 허용한다 — 빈 선택은 안내 문구로 알리고 저장 버튼은 상위 화면에서 막는다
  const toggleAll = (): void => {
    onChange(isAllSelected ? [] : [...ALL_CATEGORIES]);
  };

  const toggleCategory = (cat: Category): void => {
    if (value.includes(cat)) {
      onChange(value.filter((c) => c !== cat));
    } else {
      onChange([...value, cat]);
    }
  };

  return (
    <View sx={{ gap: spacing.SM }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.SM, paddingRight: spacing.MD }}>
        <CategoryChip label="전체" active={isAllSelected} onPress={toggleAll} />
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
