import { useMemo } from 'react';
import { View } from 'dripsy';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, Group, Picture, Skia, createPicture, type SkPicture } from '@shopify/react-native-skia';
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { getSpritePixels, getSpriteSize } from '@sketch-catch/shared';
import { COIN_SPRITE, colors } from '@/shared/config';
import { useCoverTransition, type CoverTransitionProps } from '../../lib/useCoverTransition';
import { CoverStatus } from '../CoverStatus';

type CoinSpec = {
  key: number;
  x: number;
  pixel: number; // 도트 1칸 크기 — 코인마다 달라 원근감이 생긴다
  delay: number; // 시계(덮는 시간=1) 기준 첫 출발 시점
  fall: number; // 시계 기준 한 번 떨어지는 데 걸리는 시간
  spin: number;
  phase: number;
};

const COIN_COUNT = 64;
const COIN = getSpriteSize(COIN_SPRITE);
const COVER_MS = 560;
const MAX_FALL = 1.35;
// 걷기 시작한 순간 막 출발한 코인도 화면 아래로 빠져나갈 때까지 기다린다
const REVEAL_MS = Math.ceil(COVER_MS * MAX_FALL) + 40;

// 코인 1개를 도트 1칸=1pt 크기의 Picture로 한 번만 그려 두고 크기만 키워 재사용한다
function createCoinPicture(): SkPicture {
  return createPicture(
    canvas => {
      const paint = Skia.Paint();
      for (const { x, y, color } of getSpritePixels(COIN_SPRITE)) {
        paint.setColor(Skia.Color(color));
        canvas.drawRect(Skia.XYWHRect(x, y, 1, 1), paint);
      }
    },
    { width: COIN.width, height: COIN.height },
  );
}

function createCoinSpecs(width: number): CoinSpec[] {
  return Array.from({ length: COIN_COUNT }, (_, key) => ({
    key,
    x: Math.random() * width,
    pixel: 3 + Math.floor(Math.random() * 3),
    delay: Math.random() * 0.6,
    fall: 0.9 + Math.random() * (MAX_FALL - 0.9),
    spin: 1.5 + Math.random() * 2,
    phase: Math.random() * Math.PI * 2,
  }));
}

function FallingCoin({
  spec,
  clock,
  release,
  height,
  picture,
}: {
  spec: CoinSpec;
  clock: SharedValue<number>;
  release: SharedValue<number>;
  height: number;
  picture: SkPicture;
}) {
  const size = COIN.width * spec.pixel;
  const transform = useDerivedValue(() => {
    const k = (clock.value - spec.delay) / spec.fall;
    const cycle = Math.floor(k);
    // 걷기 시작한 뒤에는 그때 떨어지던 코인만 마저 떨어지고 새로 출발하지 않는다
    const released = release.value >= 0 && cycle > Math.floor((release.value - spec.delay) / spec.fall);
    if (k < 0 || released) return [{ translateY: -size * 2 }];
    const t = k - cycle;
    // 처음엔 천천히, 갈수록 빨라지도록 중력처럼 가속한다
    const y = -size + (height + size * 2) * t * t;
    const flip = Math.cos(clock.value * Math.PI * spec.spin + spec.phase);
    return [
      { translateX: spec.x + size / 2 },
      { translateY: y },
      { scaleX: flip * spec.pixel },
      { scaleY: spec.pixel },
      { translateX: -COIN.width / 2 },
    ];
  });
  return (
    <Group transform={transform}>
      <Picture picture={picture} />
    </Group>
  );
}

// 옷장 → 샵 전환: 픽셀 코인이 위에서 우수수 쏟아지며 화면을 덮었다가 아래로 빠져나간다.
// 덮인 채 기다리는 동안(샵 진입 로딩)에는 코인이 계속 쏟아진다
export function CoinRainTransition({ startCovered, ready, onCovered, onDone, children }: CoverTransitionProps) {
  const { width, height } = useWindowDimensions();
  const picture = useMemo(createCoinPicture, []);
  const coins = useMemo(() => createCoinSpecs(width), [width]);
  const progress = useCoverTransition({
    sound: 'coins',
    coverMs: COVER_MS,
    holdMs: 0,
    revealMs: REVEAL_MS,
    startCovered,
    ready,
    onCovered,
    onDone,
  });
  // 코인 위치는 덮기 진행도와 별개인 시계로 움직여, 기다리는 동안에도 멈추지 않는다
  const clock = useSharedValue(startCovered ? 1 : 0);
  const release = useSharedValue(-1);
  useFrameCallback(frame => {
    clock.value += (frame.timeSincePreviousFrame ?? 0) / COVER_MS;
  });
  useAnimatedReaction(
    () => progress.value > 1,
    (revealing, wasRevealing) => {
      if (revealing && !wasRevealing && release.value < 0) release.value = clock.value;
    },
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.85, 1.15, 2], [0, 1, 1, 0]),
  }));

  return (
    <View pointerEvents="auto" style={[StyleSheet.absoluteFill, styles.root]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      <Canvas style={StyleSheet.absoluteFill}>
        {coins.map(spec => (
          <FallingCoin
            key={spec.key}
            spec={spec}
            clock={clock}
            release={release}
            height={height}
            picture={picture}
          />
        ))}
      </Canvas>
      <CoverStatus progress={progress}>{children}</CoverStatus>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 10 },
  backdrop: { backgroundColor: colors.DARK_400 },
});
