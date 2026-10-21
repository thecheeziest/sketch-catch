import { useEffect, useRef, useState } from 'react';
import { Image, Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { fontFamily, getCharacterColor, getCharacterImageSource } from '@/shared/config';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { CosmeticChatText } from '@/shared/ui/CosmeticChatText';
import { chatStream } from '@/features/game/config';

export type ChatStreamItem = {
  id: string;
  nickname: string;
  text: string;
  characterId: string;
  isCorrect: boolean;
  /** 정답 시 획득 점수 — 도착 전(찰나)에는 배지를 "정답"으로 대체 표시 */
  score?: number;
  /** 상점에서 산 채팅 글자색 — null이면 기본색 */
  textColor?: string | null;
  chatColorId?: string | null;
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
  // 서버 createdAt은 폰 시계와 어긋날 수 있어(폰이 빠르면 말풍선이 아예 안 뜬다) 이 기기가 처음 받은 시각으로 노출 시간을 잰다.
  // 화면 진입 시점에 이미 있던 메시지는 지난 채팅이므로 띄우지 않는다.
  const receivedAtRef = useRef<Map<string, number> | null>(null);
  if (receivedAtRef.current === null) receivedAtRef.current = new Map(items.map((i) => [i.id, -Infinity]));
  const receivedAt = receivedAtRef.current;
  const now = Date.now();
  for (const item of items) {
    if (!receivedAt.has(item.id)) receivedAt.set(item.id, now);
  }
  for (const id of receivedAt.keys()) {
    if (!items.some((i) => i.id === id)) receivedAt.delete(id);
  }
  const isAlive = (item: ChatStreamItem): boolean => Date.now() - (receivedAt.get(item.id) ?? -Infinity) < DISPLAY_MS;

  // 노출 만료는 시간 경과만으로도 재렌더가 필요 — items가 안 바뀌어도 틱을 돌리다가,
  // 살아있는 메시지가 없어지면 인터벌을 스스로 정리한다(무한 리렌더 방지).
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!items.some(isAlive)) return undefined;
    const id = setInterval(() => {
      setTick((t) => t + 1);
      if (!items.some(isAlive)) clearInterval(id);
    }, 500);
    return () => clearInterval(id);
    // isAlive는 렌더마다 새로 만들어지지만 읽는 Map은 같은 ref라 items 변경 시에만 재구독하면 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const visible = items.filter(isAlive);

  return (
    <View pointerEvents="none" style={styles.container}>
      {visible.map((item, index) => {
        const ageBg = AGE_STEPS[AGE_STEPS.length - visible.length + index] ?? AGE_STEPS[AGE_STEPS.length - 1];
        // 글자색을 산 메시지는 대비를 지키려고 가장 어두운 단계 배경에 얹는다
        const hasTextColor = !item.isCorrect && !!item.textColor;
        const bg = (() => {
          if (item.isCorrect) return chatStream.CORRECT_BG;
          if (hasTextColor) return AGE_STEPS[AGE_STEPS.length - 1];
          return ageBg;
        })();
        const fg = (() => {
          if (item.isCorrect) return chatStream.CORRECT_FG;
          return item.textColor ?? chatStream.TEXT_FG;
        })();
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
                maxWidth: '100%',
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
              {/* 긴 채팅도 말줄임 없이 전체를 보여준다 (최대 30자라 두세 줄 안에서 끝난다) */}
              <CosmeticChatText
                itemId={item.isCorrect ? null : item.chatColorId}
                color={item.chatColorId && hasTextColor ? undefined : fg}
              >
                {item.text}
              </CosmeticChatText>
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
    width: '72%',
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
