import { Image, Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import { colors, fontFamily, getCharacterColor, getCharacterImageSource } from '@/shared/config';
import { PixelFrame } from '@/shared/ui/PixelFrame';

type Props = {
  characterId: string;
  text: string;
  /** 이 글자 위치(코드 포인트 기준)부터 빨간색으로 강조 */
  highlightFrom?: number;
};

const CHIP_SIZE = 16;

// 키보드가 올라온 공개식 — 캐릭터 발표를 대기실 채팅처럼 한 줄로 작게 보여 준다
export function RevealChatLine({ characterId, text, highlightFrom }: Props) {
  const imageSource = getCharacterImageSource(characterId);
  const chars = Array.from(text);
  const hasHighlight = highlightFrom !== undefined && chars.length > highlightFrom;

  return (
    <View style={styles.row}>
      <PixelFrame borderColor={colors.BLACK} borderWidth={3} style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_300 }]} />
      </PixelFrame>
      <View sx={sxStyles.content}>
        {imageSource !== null ? (
          <Image source={imageSource} sx={{ width: CHIP_SIZE, height: CHIP_SIZE }} resizeMode="contain" />
        ) : (
          <View style={{ width: CHIP_SIZE, height: CHIP_SIZE, backgroundColor: getCharacterColor(characterId).main }} />
        )}
        <Text numberOfLines={1} sx={sxStyles.text}>
          {hasHighlight ? (
            <>
              {chars.slice(0, highlightFrom).join('')}
              <Text sx={{ color: colors.ERROR_400 }}>{chars.slice(highlightFrom).join('')}</Text>
            </>
          ) : (
            text
          )}
        </Text>
      </View>
    </View>
  );
}

const sxStyles = {
  content: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  text: { flexShrink: 1, fontFamily: fontFamily.REGULAR, fontSize: 12, lineHeight: 15, color: colors.LIGHT_100 },
};

const styles = StyleSheet.create({
  row: { alignSelf: 'flex-start', maxWidth: '100%' },
});
