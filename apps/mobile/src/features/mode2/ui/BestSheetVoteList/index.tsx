import { useState } from 'react';
import { Image, Text, View } from 'dripsy';
import { type LayoutChangeEvent, Pressable, StyleSheet } from 'react-native';
import { colors, getCharacterImageSource, spacing, textSizes } from '@/shared/config';
import { FlatList } from '@/shared/ui/FlatList';
import { PixelFrame } from '@/shared/ui/PixelFrame';

export type VoteSheet = {
  sheetId: string;
  ownerId: string;
  nickname: string;
  characterId: string;
};

type Props = {
  sheets: VoteSheet[];
  myId: string;
  selectedId: string | null;
  onSelect: (sheetId: string) => void;
};

const CARD_SIZE = 96;

export function BestSheetVoteList({ sheets, myId, selectedId, onSelect }: Props) {
  const [numColumns, setNumColumns] = useState(1);

  const handleLayout = (e: LayoutChangeEvent): void => {
    const width = e.nativeEvent.layout.width;
    setNumColumns(Math.max(1, Math.floor(width / (CARD_SIZE + spacing.SM * 2))));
  };

  // 본인 시트는 목록에서 제외 (D-06)
  const votable = sheets.filter((s) => s.ownerId !== myId);

  return (
    <FlatList
      key={numColumns}
      data={votable}
      keyExtractor={(item) => item.sheetId}
      numColumns={numColumns}
      onLayout={handleLayout}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => {
        const selected = item.sheetId === selectedId;
        const source = getCharacterImageSource(item.characterId);
        return (
          <Pressable onPress={() => onSelect(item.sheetId)} style={styles.card}>
            <PixelFrame
              borderColor={selected ? colors.PRIMARY_400 : colors.SECONDARY_300}
              style={StyleSheet.absoluteFill}
            >
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_100 }]} />
            </PixelFrame>
            <View sx={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {source !== null ? (
                <Image source={source} sx={{ width: 48, height: 48 }} resizeMode="contain" />
              ) : (
                <View sx={{ width: 48, height: 48, backgroundColor: colors.SECONDARY_400 }} />
              )}
            </View>
            <View sx={{ paddingBottom: spacing.XS, paddingHorizontal: spacing.XS }}>
              <Text sx={{ ...textSizes.B3, color: colors.LIGHT_100, textAlign: 'center' }} numberOfLines={1}>
                {item.nickname}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.SM },
  card: { width: CARD_SIZE, height: CARD_SIZE, margin: spacing.SM },
});
