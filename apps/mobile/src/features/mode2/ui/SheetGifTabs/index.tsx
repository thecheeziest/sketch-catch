import { colors, getCharacterImageSource, spacing, textSizes } from '@/shared/config';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { Image, ScrollView, Text, View } from 'dripsy';
import { Pressable, StyleSheet } from 'react-native';

export type SheetGifTabItem = {
  sheetId: string;
  nickname: string;
  characterId: string;
  label: string;
};

type Props = {
  sheets: SheetGifTabItem[];
  selectedId: string | null;
  onSelect: (sheetId: string) => void;
};

const THUMB_SIZE = 96;

export function SheetGifTabs({ sheets, selectedId, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      sx={{ paddingVertical: spacing.SM }}
      contentContainerSx={{ flexDirection: 'row', paddingHorizontal: spacing.MD, gap: spacing.SM }}
    >
      {sheets.map((sheet) => {
        const selected = sheet.sheetId === selectedId;
        const imageSource = getCharacterImageSource(sheet.characterId);
        return (
          <Pressable
            key={sheet.sheetId}
            onPress={() => onSelect(sheet.sheetId)}
            accessibilityLabel={`${sheet.label} GIF 보기`}
          >
            <View sx={{ width: THUMB_SIZE, height: THUMB_SIZE }}>
              <PixelFrame
                borderColor={selected ? colors.PRIMARY_400 : colors.SECONDARY_300}
                borderWidth={selected ? 3 : 2}
                style={StyleSheet.absoluteFill}
              >
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_100 }]} />
                <View sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.XS }}>
                  {imageSource !== null ? (
                    <Image source={imageSource} sx={{ width: 40, height: 40 }} resizeMode="contain" />
                  ) : (
                    <View sx={{ width: 40, height: 40, backgroundColor: colors.SECONDARY_400 }} />
                  )}
                  <Text sx={{ ...textSizes.B4, color: colors.LIGHT_100, textAlign: 'center' }} numberOfLines={1}>
                    {sheet.label}
                  </Text>
                </View>
              </PixelFrame>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
