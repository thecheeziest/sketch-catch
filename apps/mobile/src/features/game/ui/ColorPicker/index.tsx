import { Pressable, StyleSheet } from 'react-native';
import { View } from 'dripsy';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { colors } from '@/shared/config';

type ColorOption = {
  value: string;
  label: string;
};

// UI-SPEC Drawing Tool Spec 색상 팔레트 순서
const COLOR_OPTIONS: ColorOption[] = [
  { value: colors.DARK_500, label: '검정' },
  { value: colors.LIGHT_100, label: '흰색' },
  { value: colors.PRIMARY_400, label: '분홍' },
  { value: colors.SECONDARY_300, label: '보라' },
  { value: colors.INFO_300, label: '파랑' },
  { value: colors.ACCENT_300, label: '초록' },
];

const DOT_SIZE = 32;
const BORDER_SIZE = DOT_SIZE + 8; // PRIMARY_400 링 포함 크기

type Props = {
  value: string;
  onChange: (c: string) => void;
};

export function ColorPicker({ value, onChange }: Props) {
  return (
    <View sx={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {COLOR_OPTIONS.map((opt) => {
        const isSelected = opt.value === value;
        const bgColor = opt.value;
        return (
          <Pressable
            key={bgColor}
            onPress={() => onChange(bgColor)}
            hitSlop={8}
            accessibilityLabel={`색상 선택: ${opt.label}`}
            style={styles.dotWrapper}
          >
            {isSelected ? (
              <View style={{ width: BORDER_SIZE, height: BORDER_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                <PixelFrame
                  borderColor={colors.PRIMARY_400}
                  borderWidth={2}
                  style={StyleSheet.absoluteFillObject}
                >
                  <View style={{ flex: 1 }} />
                </PixelFrame>
                <View style={[styles.dot, { backgroundColor: bgColor }]} />
              </View>
            ) : (
              <View style={[styles.dot, { backgroundColor: bgColor }]} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dotWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: BORDER_SIZE,
    height: BORDER_SIZE,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});
