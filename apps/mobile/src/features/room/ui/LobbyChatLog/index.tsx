import { Image, Text, View } from 'dripsy';
import { type ListRenderItem, StyleSheet } from 'react-native';
import type { ChatMessage } from '@sketch-catch/shared';
import { colors, fontFamily, getCharacterColor, getCharacterImageSource } from '@/shared/config';
import { FlatList } from '@/shared/ui';
import { PixelFrame } from '@/shared/ui/PixelFrame';

type Props = {
  /** 오래된 것이 앞, 최신이 뒤 */
  messages: ChatMessage[];
  characterIdOf: (userId: string) => string;
};

const CHIP_SIZE = 16;

// 대기실 채팅 로그 — 왼쪽 상단부터 아래에서 위로 쌓이고, 시간이 지나도 사라지지 않고 스크롤로 이어진다.
// inverted 리스트라 데이터는 최신이 앞에 오도록 뒤집어 넘긴다.
export function LobbyChatLog({ messages, characterIdOf }: Props) {
  const data = [...messages].reverse();

  const renderItem: ListRenderItem<ChatMessage> = ({ item }) => {
    const characterId = characterIdOf(item.userId);
    const imageSource = getCharacterImageSource(characterId);
    return (
      <View style={styles.row}>
        <PixelFrame borderColor={colors.BLACK} borderWidth={3} style={StyleSheet.absoluteFill}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_300 }]} />
        </PixelFrame>
        <View sx={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 7 }}>
          {imageSource !== null ? (
            <Image source={imageSource} sx={{ width: CHIP_SIZE, height: CHIP_SIZE }} resizeMode="contain" />
          ) : (
            <View
              style={{ width: CHIP_SIZE, height: CHIP_SIZE, backgroundColor: getCharacterColor(characterId).main }}
            />
          )}
          <Text sx={{ fontFamily: fontFamily.REGULAR, fontSize: 11, color: colors.LIGHT_300, flexShrink: 0 }}>
            {item.nickname}
          </Text>
          <Text sx={{ fontFamily: fontFamily.REGULAR, fontSize: 13, color: colors.LIGHT_100, flexShrink: 1 }}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <FlatList<ChatMessage>
      inverted
      data={data}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      style={styles.list}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, minHeight: 96 },
  content: { gap: 6, paddingHorizontal: 16, paddingVertical: 8 },
  row: { alignSelf: 'flex-start', maxWidth: '80%' },
});
