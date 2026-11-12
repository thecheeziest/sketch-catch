import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import { colors, fontFamily } from '@/shared/config';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { chatStream } from '@/features/game/config';

type Props = {
  text: string;
  /** 꼬리 방향 — 말하는 캐릭터 쪽 */
  tail: 'up' | 'down';
  background?: string;
  textColor?: string;
  numberOfLines?: number;
  /** 한 줄 문구를 칸에 맞게 줄인다 — 여러 줄 안내문은 false로 기본 크기를 유지한다 */
  shrinkToFit?: boolean;
  /** 이 글자 위치(코드 포인트 기준)부터 빨간색으로 강조 */
  highlightFrom?: number;
};

const PX = 3;
const INK = chatStream.BORDER;
// 꼬리 끝(1칸) → 몸통 쪽(3칸)으로 넓어지는 계단 + 몸통 테두리를 터 주는 마지막 줄
const TAIL_ROWS = [
  { outer: 2, inner: 0 },
  { outer: 4, inner: 2 },
  { outer: 6, inner: 4 },
  { outer: 0, inner: 4 },
] as const;

// 가로로 긴 픽셀 말풍선 — 정답 공개식에서 캐릭터가 말하는 문구를 담는다
export function PixelSpeechBubble({
  text,
  tail,
  background = '#FFFFFF',
  textColor = '#1D1629',
  numberOfLines = 1,
  shrinkToFit = true,
  highlightFrom,
}: Props) {
  const chars = Array.from(text);
  const hasHighlight = highlightFrom !== undefined && chars.length > highlightFrom;
  const rows = tail === 'up' ? TAIL_ROWS : [...TAIL_ROWS].reverse();

  return (
    <View sx={{ alignSelf: 'stretch', position: 'relative', minHeight: 40, justifyContent: 'center' }}>
      <PixelFrame borderColor={INK} borderWidth={PX} notchSize={PX * 2} style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: background }]} />
      </PixelFrame>
      <Text
        numberOfLines={numberOfLines}
        adjustsFontSizeToFit={shrinkToFit}
        minimumFontScale={0.6}
        style={[styles.text, { color: textColor }]}
      >
        {hasHighlight ? (
          <>
            {chars.slice(0, highlightFrom).join('')}
            <Text sx={{ color: colors.ERROR_400 }}>{chars.slice(highlightFrom).join('')}</Text>
          </>
        ) : (
          text || ' '
        )}
      </Text>
      <View pointerEvents="none" style={[styles.tail, tail === 'up' ? styles.tailUp : styles.tailDown]}>
        {rows.map((row, index) => (
          <View
            key={index}
            style={{ width: (row.outer || row.inner) * PX, height: PX, backgroundColor: row.outer ? INK : background }}
          >
            {row.outer > 0 && row.inner > 0 && (
              <View style={{ marginHorizontal: PX, height: PX, backgroundColor: background }} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: fontFamily.REGULAR,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tail: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  // 마지막 줄이 몸통 테두리(PX) 위에 겹치도록 3칸 + 1칸 위치를 맞춘다
  tailUp: {
    top: -PX * 3,
  },
  tailDown: {
    bottom: -PX * 3,
  },
});
