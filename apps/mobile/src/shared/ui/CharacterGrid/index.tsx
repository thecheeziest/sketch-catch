import { CHARACTER_IDS, colors, getCharacterImageSource, spacing } from '@/shared/config';
import { Image, View } from 'dripsy';
import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet } from 'react-native';
import { FlatList } from '../FlatList';
import { PixelFrame } from '../PixelFrame';

const NUM_COLS = 4;

type Props = {
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function CharacterGrid({ selectedId, onSelect }: Props) {
  const [cellSize, setCellSize] = useState(0);

  const handleLayout = (e: LayoutChangeEvent): void => {
    const width = e.nativeEvent.layout.width;
    setCellSize(Math.floor((width - NUM_COLS * spacing.XS * 2) / NUM_COLS));
  };

  return (
    <FlatList
      data={CHARACTER_IDS}
      numColumns={NUM_COLS}
      keyExtractor={(id) => id}
      onLayout={handleLayout}
      contentContainerStyle={{ alignItems: 'center' }}
      renderItem={({ item }) => {
        if (cellSize === 0) return null;
        const source = getCharacterImageSource(item);
        const selected = selectedId === item;
        const imgSize = Math.floor(cellSize * 0.78);
        const borderColor = selected ? colors.PRIMARY_300 : colors.SECONDARY_200;
        const backgroundColor = selected ? colors.PRIMARY_100 : colors.LIGHT_300;
        return (
          <Pressable
            onPress={() => onSelect(item)}
            style={({ pressed }) => [styles.cell, { width: cellSize, height: cellSize }, pressed && { opacity: 0.7 }]}
          >
            <PixelFrame borderColor={borderColor} style={StyleSheet.absoluteFill}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor }]} />
              <View style={styles.cellContent}>
                {source && (
                  <Image
                    source={source}
                    sx={{ width: imgSize, height: imgSize }}
                    resizeMode="contain"
                  />
                )}
              </View>
            </PixelFrame>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  cell: { margin: spacing.XS },
  cellContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
