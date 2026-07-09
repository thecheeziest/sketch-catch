import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { colors } from '@/shared/config';

const BURST_COLORS = [
  colors.PRIMARY_300,
  colors.ACCENT_300,
  colors.INFO_300,
  colors.WARNING_300,
  colors.SECONDARY_300,
  colors.PRIMARY_100,
  colors.WARNING_200,
  colors.ACCENT_100,
];

type ParticleConfig = {
  angle: number;
  distance: number;
  color: string;
  size: number;
};

type BurstConfig = {
  offsetX: number;
  offsetY: number;
  delay: number;
  particles: ParticleConfig[];
};

function makeBurstParticles(count: number): ParticleConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * 2 * Math.PI,
    distance: 70 + (i % 3) * 20,
    color: BURST_COLORS[i % BURST_COLORS.length]!,
    size: i % 2 === 0 ? 8 : 6,
  }));
}

// 3개 버스트: 중앙 상단 → 좌하 → 우하 순서로 연속 발사
const BURST_CONFIGS: BurstConfig[] = [
  { offsetX: 0, offsetY: -70, delay: 0, particles: makeBurstParticles(8) },
  { offsetX: -90, offsetY: 50, delay: 350, particles: makeBurstParticles(6) },
  { offsetX: 90, offsetY: 50, delay: 700, particles: makeBurstParticles(6) },
];

type PixelParticleProps = {
  progress: SharedValue<number>;
  cx: number;
  cy: number;
  angle: number;
  distance: number;
  color: string;
  size: number;
};

function PixelParticle({ progress, cx, cy, angle, distance, color, size }: PixelParticleProps) {
  const animStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      left: cx + Math.cos(angle) * distance * p - size / 2,
      top: cy + Math.sin(angle) * distance * p - size / 2,
      opacity: p < 0.3 ? 1 : Math.max(0, 1 - (p - 0.3) / 0.7),
    };
  });

  return (
    <Animated.View
      style={[{ position: 'absolute', width: size, height: size, backgroundColor: color }, animStyle]}
      pointerEvents="none"
    />
  );
}

type FireworkBurstProps = {
  config: BurstConfig;
  screenCX: number;
  screenCY: number;
};

function FireworkBurst({ config, screenCX, screenCY }: FireworkBurstProps) {
  const progress = useSharedValue(0);
  const cx = screenCX + config.offsetX;
  const cy = screenCY + config.offsetY;

  useEffect(() => {
    progress.value = withDelay(
      config.delay,
      withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
    );
  }, [progress, config.delay]);

  return (
    <>
      {config.particles.map((p, i) => (
        <PixelParticle
          key={i}
          progress={progress}
          cx={cx}
          cy={cy}
          angle={p.angle}
          distance={p.distance}
          color={p.color}
          size={p.size}
        />
      ))}
    </>
  );
}

export function PixelFireworks() {
  const { width, height } = useWindowDimensions();
  const screenCX = width / 2;
  const screenCY = height / 2;

  return (
    <Animated.View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {BURST_CONFIGS.map((config, i) => (
        <FireworkBurst key={i} config={config} screenCX={screenCX} screenCY={screenCY} />
      ))}
    </Animated.View>
  );
}
