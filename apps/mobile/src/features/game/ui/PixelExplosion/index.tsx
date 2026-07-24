import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors } from '@/shared/config';

const BLAST_COLORS = [colors.ERROR_400, colors.ERROR_300, colors.WARNING_400, colors.DARK_500, colors.GRAY];

type ParticleConfig = {
  angle: number;
  distance: number;
  color: string;
  size: number;
};

function makeBlastParticles(count: number): ParticleConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * 2 * Math.PI + (i % 2 === 0 ? 0.15 : -0.15),
    distance: 55 + (i % 3) * 18,
    color: BLAST_COLORS[i % BLAST_COLORS.length]!,
    size: i % 2 === 0 ? 9 : 6,
  }));
}

const PARTICLES = makeBlastParticles(12);

type PixelParticleProps = {
  progress: ReturnType<typeof useSharedValue<number>>;
  cx: number;
  cy: number;
  angle: number;
  distance: number;
  color: string;
  size: number;
};

function BlastParticle({ progress, cx, cy, angle, distance, color, size }: PixelParticleProps) {
  const animStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      left: cx + Math.cos(angle) * distance * p - size / 2,
      top: cy + Math.sin(angle) * distance * p - size / 2,
      opacity: p < 0.4 ? 1 : Math.max(0, 1 - (p - 0.4) / 0.6),
    };
  });

  return (
    <Animated.View
      style={[{ position: 'absolute', width: size, height: size, backgroundColor: color }, animStyle]}
      pointerEvents="none"
    />
  );
}

// 정답 시 PixelFireworks에 대응하는 오답 연출 — 화면 중앙 1회 폭발
export function PixelExplosion() {
  const { width, height } = useWindowDimensions();
  const screenCX = width / 2;
  const screenCY = height / 2;
  const progress = useSharedValue(0);
  const flash = useSharedValue(0);

  useEffect(() => {
    flash.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) }, () => {
      flash.value = withTiming(0, { duration: 250 });
    });
    progress.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value * 0.5,
  }));

  return (
    <Animated.View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Animated.View
        style={[
          styles.flash,
          { left: screenCX - 60, top: screenCY - 60, backgroundColor: colors.WARNING_300 },
          flashStyle,
        ]}
      />
      {PARTICLES.map((p, i) => (
        <BlastParticle
          key={i}
          progress={progress}
          cx={screenCX}
          cy={screenCY}
          angle={p.angle}
          distance={p.distance}
          color={p.color}
          size={p.size}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flash: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
  },
});
