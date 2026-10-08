import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { View } from 'dripsy';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { drawingPalette, toolbar } from '@/features/game/config';

const COLUMNS = 8;
const GAP = 5;
const SWATCH_HEIGHT = 34;
/** 툴바 컨테이너 좌우 패딩 합(12*2) */
const TOOLBAR_H_PADDING = 24;

type Props = {
  value: string;
  onChange: (c: string) => void;
};

export function ColorPicker({ value, onChange }: Props) {
  const { width } = useWindowDimensions();
  const swatchWidth = Math.floor((width - TOOLBAR_H_PADDING - GAP * (COLUMNS - 1)) / COLUMNS);
  const normalizedValue = value.toLowerCase();

  return (
    <View sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
      {drawingPalette.map(swatch => {
        const isSelected = swatch.toLowerCase() === normalizedValue;
        let borderColor: string = toolbar.SWATCH_BORDER;
        if (swatch === '#14101C') borderColor = '#FFFFFF';
        if (isSelected) borderColor = toolbar.SWATCH_SELECTED;
        return (
          <Pressable
            key={swatch}
            onPress={() => onChange(swatch)}
            accessibilityLabel={`색상 선택 ${swatch}`}
            style={{ width: swatchWidth, height: SWATCH_HEIGHT }}
          >
            <PixelFrame
              borderColor={borderColor}
              borderWidth={isSelected ? 3 : 2}
              notchSize={3}
              style={StyleSheet.absoluteFill}
            >
              <View style={[StyleSheet.absoluteFill, { backgroundColor: swatch }]} />
            </PixelFrame>
          </Pressable>
        );
      })}
    </View>
  );
}
