import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Text, View } from 'dripsy';
import { AccessibilityInfo, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  cancelAnimation,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { fontFamily, getCharacterImageSource } from '@/shared/config';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { PixelLoadingSpinner } from '@/shared/ui/PixelLoadingSpinner';
import { chatStream, resultOverlay } from '@/features/game/config';
import type { GameResultOverlayData } from '@/features/game/model/resultOverlay';

type Props = {
  data: GameResultOverlayData;
  onDismiss?: () => void;
};

// 노출 예산 = fade in 0.2s + hold 1.5s + fade out 0.3s = 정확히 2.0s
const FADE_IN_MS = 200;
const HOLD_MS = 1500;
const FADE_OUT_MS = 300;
const TOTAL_MS = FADE_IN_MS + HOLD_MS + FADE_OUT_MS;

const TITLE: Record<GameResultOverlayData['kind'], string> = {
  waiting: '제시어 입력 중..',
  correct: '정답입니다!',
  wrong: '오답입니다!',
  gameover: 'GAME OVER',
};

const TOKENS = {
  waiting: {
    ...resultOverlay.CORRECT,
    ACCENT: resultOverlay.GOLD.BG,
    ACCENT_DARK: resultOverlay.GOLD.ACCENT_DARK,
    ON_ACCENT: resultOverlay.GOLD.FG,
    CHIP_BG: resultOverlay.GOLD.ACCENT_DARK,
    CHIP_FG: '#FFF4D6',
  },
  correct: resultOverlay.CORRECT,
  wrong: resultOverlay.WRONG,
  gameover: resultOverlay.GAMEOVER,
};

function getMetaText(data: GameResultOverlayData): string {
  if (data.kind === 'waiting') return '출제자가 제시어를 입력하고 있어요';
  if (data.kind === 'correct') return `${data.winnerName} · ${data.solveSeconds}초`;
  if (data.kind === 'wrong') return `${data.guesserName} · ${data.guess}`;
  return '아무도 못 맞혔어요';
}

/** RN에 CSS steps() 이징이 없어 진행값 자체를 n단으로 양자화해 흉내낸다 (픽셀 룩 유지). */
function makeStepEasing(steps: number) {
  return (t: number) => {
    'worklet';
    return Math.floor(t * steps) / steps;
  };
}

function useReducedMotionPref(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(v => mounted && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

// 결과 슬래브 / 정답 슬래브 — ink 4px 프레임 + 하단 3px 발판(foot)으로 3D 키캡 느낌
function PixelSlab({
  bg,
  footColor,
  footHeight,
  paddingH,
  paddingV,
  children,
}: {
  bg: string;
  footColor: string;
  footHeight: number;
  paddingH: number;
  paddingV: number;
  children: ReactNode;
}) {
  return (
    <View>
      <View sx={{ position: 'relative' }}>
        <PixelFrame borderColor={chatStream.BORDER} borderWidth={4} notchSize={0} style={StyleSheet.absoluteFill}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />
        </PixelFrame>
        <View sx={{ paddingHorizontal: paddingH, paddingVertical: paddingV, alignItems: 'center' }}>{children}</View>
      </View>
      <View style={{ height: footHeight, backgroundColor: footColor }} />
    </View>
  );
}

// 점수 칩 / 메타 칩 — ink 3px 프레임만 (발판 없음)
function PixelChip({
  bg,
  paddingH,
  paddingV,
  children,
}: {
  bg: string;
  paddingH: number;
  paddingV: number;
  children: ReactNode;
}) {
  return (
    <View sx={{ position: 'relative' }}>
      <PixelFrame borderColor={chatStream.BORDER} borderWidth={3} notchSize={0} style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />
      </PixelFrame>
      <View sx={{ paddingHorizontal: paddingH, paddingVertical: paddingV }}>{children}</View>
    </View>
  );
}

const PET_SIZE = 40;

function PetGlyph({
  characterId,
  kind,
  reduced,
}: {
  characterId: string;
  kind: Exclude<GameResultOverlayData['kind'], 'waiting'>;
  reduced: boolean;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (reduced) return undefined;
    if (kind === 'correct') {
      // hop .9s ease-in-out infinite
      translateY.value = withRepeat(
        withSequence(withTiming(-7, { duration: 360 }), withTiming(0, { duration: 540 })),
        -1,
        false,
      );
    } else {
      // shiver — wrong .24s / gameover .28s, steps(2) infinite
      const half = (kind === 'wrong' ? 240 : 280) / 2;
      translateX.value = withRepeat(
        withSequence(withTiming(-2, { duration: half }), withTiming(2, { duration: half })),
        -1,
        true,
      );
    }
    return () => {
      cancelAnimation(translateX);
      cancelAnimation(translateY);
    };
  }, [kind, reduced, translateX, translateY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  const imageSource = getCharacterImageSource(characterId);

  return (
    <Animated.View style={[{ width: PET_SIZE, height: PET_SIZE }, style]}>
      {imageSource !== null ? (
        <Image source={imageSource} sx={{ width: PET_SIZE, height: PET_SIZE }} resizeMode="contain" />
      ) : (
        <View sx={{ width: PET_SIZE, height: PET_SIZE, backgroundColor: TOKENS[kind].ACCENT }} />
      )}
    </Animated.View>
  );
}

type ConfettiPieceData = {
  key: number;
  size: number;
  color: string;
  dx: number;
  dy: number;
  delay: number;
  isX: boolean;
};

function pieceSize(baseSize: number, index: number, isX: boolean): number {
  const isEvery3rd = index % 3 === 0;
  if (isX) return isEvery3rd ? baseSize + 6 : baseSize + 3;
  return isEvery3rd ? baseSize + 4 : baseSize;
}

function makeConfetti(
  count: number,
  radius: number,
  colors: readonly string[],
  baseSize: number,
  isX: boolean,
): ConfettiPieceData[] {
  return Array.from({ length: count }, (_, k) => {
    const angle = (k / count) * Math.PI * 2;
    const size = pieceSize(baseSize, k, isX);
    return {
      key: k,
      size,
      color: colors[k % colors.length]!,
      dx: Math.round(Math.cos(angle) * radius),
      dy: Math.round(Math.sin(angle) * radius),
      delay: (k % 4) * 0.05,
      isX,
    };
  });
}

const CONFETTI_BY_KIND: Record<GameResultOverlayData['kind'], () => ConfettiPieceData[]> = {
  waiting: () => [],
  correct: () => makeConfetti(12, 118, resultOverlay.CONFETTI_CORRECT, 8, false),
  wrong: () => makeConfetti(10, 112, resultOverlay.CONFETTI_WRONG, 8, true),
  gameover: () => makeConfetti(12, 116, resultOverlay.CONFETTI_GAMEOVER, 8, true),
};

function ConfettiParticle({ piece }: { piece: ConfettiPieceData }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(piece.delay * 1000, withTiming(1, { duration: TOTAL_MS, easing: makeStepEasing(9) }));
    return () => cancelAnimation(progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = interpolate(p, [0, 0.12, 0.75, 1], [0, 1, 1, 0], Extrapolation.CLAMP);
    const scale = interpolate(p, [0, 1], [0.6, 1], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [
        { translateX: piece.dx * p - piece.size / 2 },
        { translateY: piece.dy * p - piece.size / 2 },
        { scale },
      ],
    };
  });

  if (piece.isX) {
    return (
      <Animated.View style={[styles.confettiWrap, { width: piece.size, height: piece.size }, style]}>
        <View
          style={[
            styles.xBar,
            {
              width: piece.size * 0.3,
              left: piece.size * 0.35,
              backgroundColor: piece.color,
              transform: [{ rotate: '45deg' }],
            },
          ]}
        />
        <View
          style={[
            styles.xBar,
            {
              width: piece.size * 0.3,
              left: piece.size * 0.35,
              backgroundColor: piece.color,
              transform: [{ rotate: '-45deg' }],
            },
          ]}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.confettiWrap, { width: piece.size, height: piece.size }, style]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: chatStream.BORDER }]} />
      <View style={{ position: 'absolute', top: 2, left: 2, right: 2, bottom: 2, backgroundColor: piece.color }} />
    </Animated.View>
  );
}

/**
 * 출제 화면 위에 얹히는 결과 레이어 — 정답 / 오답 / 게임오버 (확정안 8b).
 * 캔버스 영역(position: relative) 안에 절대 배치해 헤더·그리드·툴바는 계속 보이게 한다.
 * 결과는 2.0s 후 사라지거나 탭으로 종료된다. 제시어 대기는 입력 완료까지 유지된다.
 */
export function ResultOverlay({ data, onDismiss }: Props) {
  const isWaiting = data.kind === 'waiting';
  const reduced = useReducedMotionPref();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(reduced ? 1 : 0.7);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (isWaiting) {
      opacity.value = withTiming(1, { duration: FADE_IN_MS });
      scale.value = withTiming(1, { duration: FADE_IN_MS });
      return () => {
        cancelAnimation(opacity);
        cancelAnimation(scale);
      };
    }
    opacity.value = withSequence(
      withTiming(1, { duration: FADE_IN_MS }),
      withDelay(HOLD_MS, withTiming(0, { duration: FADE_OUT_MS })),
    );
    if (!reduced) {
      scale.value = withSequence(
        withTiming(1.06, { duration: FADE_IN_MS }),
        withTiming(1, { duration: 90 }),
        withDelay(HOLD_MS - 90, withTiming(0.94, { duration: FADE_OUT_MS })),
      );
    }

    const timer = setTimeout(() => onDismissRef.current?.(), TOTAL_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWaiting]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const stackStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const tokens = TOKENS[data.kind];
  const confetti = reduced ? [] : CONFETTI_BY_KIND[data.kind]();

  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={onDismiss}
      pointerEvents={isWaiting ? 'none' : 'auto'}
      accessibilityRole={isWaiting ? undefined : 'button'}
      accessibilityLabel={isWaiting ? '출제자가 제시어를 입력하고 있어요' : '결과 오버레이 닫기'}
      accessibilityLiveRegion={isWaiting ? 'polite' : 'none'}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: tokens.SCRIM }, scrimStyle]}
      />

      <View pointerEvents="none" style={styles.confettiOrigin}>
        {confetti.map(piece => (
          <ConfettiParticle key={piece.key} piece={piece} />
        ))}
      </View>

      <Animated.View pointerEvents="none" style={[styles.centerStack, stackStyle]}>
        <PixelSlab bg={tokens.ACCENT} footColor={tokens.ACCENT_DARK} footHeight={6} paddingH={18} paddingV={11}>
          <Text style={{ fontFamily: fontFamily.BOLD, fontSize: 21, color: tokens.ON_ACCENT }}>{TITLE[data.kind]}</Text>
        </PixelSlab>

        {data.kind === 'correct' && (
          <PixelChip bg={resultOverlay.GOLD.BG} paddingH={12} paddingV={6}>
            <Text
              style={{ fontFamily: fontFamily.BOLD, fontSize: 16, color: resultOverlay.GOLD.FG }}
            >{`+${data.score} POINT`}</Text>
          </PixelChip>
        )}

        <PixelChip bg={tokens.CHIP_BG} paddingH={10} paddingV={5}>
          <Text style={{ fontFamily: fontFamily.REGULAR, fontSize: 12, color: tokens.CHIP_FG }}>
            {getMetaText(data)}
          </Text>
        </PixelChip>

        {data.kind === 'gameover' && (
          <PixelSlab
            bg={resultOverlay.GOLD.BG}
            footColor={resultOverlay.GOLD.ACCENT_DARK}
            footHeight={5}
            paddingH={14}
            paddingV={8}
          >
            <Text
              style={{ fontFamily: fontFamily.BOLD, fontSize: 16, color: resultOverlay.GOLD.FG }}
            >{`정답은 ${data.answer}!`}</Text>
          </PixelSlab>
        )}

        {data.kind === 'waiting' ? (
          <PixelLoadingSpinner size={40} accessibilityLabel="제시어 입력 대기 중" />
        ) : (
          <PetGlyph characterId={data.characterId} kind={data.kind} reduced={reduced} />
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  confettiOrigin: {
    position: 'absolute',
    left: '50%',
    top: '42%',
  },
  centerStack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '30%',
    alignItems: 'center',
    gap: 11,
  },
  confettiWrap: {
    position: 'absolute',
  },
  xBar: {
    position: 'absolute',
    top: 0,
    height: '100%',
  },
});
