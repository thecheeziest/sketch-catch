import { useEffect, useState } from 'react';
import { Image, Text, View } from 'dripsy';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { fontFamily, getCharacterColor, getCharacterImageSource } from '@/shared/config';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { chatStream } from '@/features/game/config';

export type ChatStreamItem = {
  id: string;
  nickname: string;
  text: string;
  characterId: string;
  isCorrect: boolean;
  createdAt: number;
  /** 정답 시 획득 점수 — 도착 전(찰나)에는 배지를 "정답"으로 대체 표시 */
  score?: number;
};

type Props = {
  /** 최근 메시지 목록 — 오래된 것이 앞, 최신이 뒤. 호출부에서 최대 5개로 잘라 전달. */
  items: ChatStreamItem[];
};

const { AGE_STEPS } = chatStream;
/** 말풍선 노출 시간 — 이후 스트림에서 사라진다 */
const DISPLAY_MS = 3000;
const CHIP_SIZE = 16;

/**
 * 캔버스 우측 상단에서 위로 밀려 올라가는 단일 추측 스트림.
 * 나이(오래됨)는 불투명 배경 밝기 단계로만 표현한다 — opacity 페이드 금지
 * (흰 캔버스 위에서 글자가 배경과 함께 흰색으로 수렴해 대비가 붕괴).
 */
export function ChatStream({ items }: Props) {
  const { width } = useWindowDimensions();
  const columnWidth = Math.floor(width * 0.72);
  const maxRowWidth = Math.floor(width * 0.7);

  // 5초 만료는 시간 경과만으로도 재렌더가 필요 — items가 안 바뀌어도 틱을 돌리다가,
  // 살아있는 메시지가 없어지면 인터벌을 스스로 정리한다(무한 리렌더 방지).
  const [, setTick] = useState(0);
  useEffect(() => {
    if (items.length === 0) return undefined;
    const id = setInterval(() => {
      setTick((t) => t + 1);
      if (!items.some((i) => Date.now() - i.createdAt < DISPLAY_MS)) clearInterval(id);
    }, 500);
    return () => clearInterval(id);
  }, [items]);

  const visible = items.filter((i) => Date.now() - i.createdAt < DISPLAY_MS);

  return (
    <View pointerEvents="none" style={[styles.container, { width: columnWidth }]}>
      {visible.map((item, index) => {
        const ageBg = AGE_STEPS[AGE_STEPS.length - visible.length + index] ?? AGE_STEPS[AGE_STEPS.length - 1];
        const bg = item.isCorrect ? chatStream.CORRECT_BG : ageBg;
        const fg = item.isCorrect ? chatStream.CORRECT_FG : chatStream.TEXT_FG;
        const nameFg = item.isCorrect ? chatStream.CORRECT_FG : chatStream.NAME_FG;
        const imageSource = getCharacterImageSource(item.characterId);

        return (
          <Animated.View
            key={item.id}
            entering={FadeInDown.duration(180)}
            exiting={FadeOut.duration(120)}
            layout={LinearTransition.duration(160)}
          >
            <PixelFrame borderColor={chatStream.BORDER} borderWidth={3} style={StyleSheet.absoluteFill}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />
            </PixelFrame>
            <View
              sx={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
                paddingHorizontal: 10,
                paddingVertical: 7,
                maxWidth: maxRowWidth,
              }}
            >
              {imageSource !== null ? (
                <Image source={imageSource} sx={{ width: CHIP_SIZE, height: CHIP_SIZE }} resizeMode="contain" />
              ) : (
                <View style={[styles.chip, { backgroundColor: getCharacterColor(item.characterId).main }]} />
              )}
              <Text
                sx={{ fontFamily: fontFamily.REGULAR, fontSize: 11, color: nameFg, flexShrink: 0 }}
                numberOfLines={1}
              >
                {item.nickname}
              </Text>
              <Text
                sx={{ fontFamily: fontFamily.REGULAR, fontSize: 13, color: fg, flexShrink: 1 }}
                numberOfLines={1}
              >
                {item.text}
              </Text>
              {item.isCorrect && (
                <Text sx={{ fontFamily: fontFamily.BOLD, fontSize: 11, color: chatStream.CORRECT_FG, flexShrink: 0 }}>
                  {item.score != null ? `+${item.score}` : '정답'}
                </Text>
              )}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    right: 10,
    alignItems: 'flex-end',
    gap: 6,
  },
  chip: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
  },
});
