import { colors } from '@/shared/config/theme';
import { loadingMotion } from '@/shared/config/loadingMotion';
import { useLoadingLoop } from '@/shared/lib/useLoadingLoop';
import { Canvas, Group, Rect } from '@shopify/react-native-skia';
import { View } from 'dripsy';
import type { StyleProp, ViewStyle } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

type Props = {
  size?: number;
  refreshing?: boolean;
  /** PullToRefresh 당김 비율: 0~1. refreshing=true이면 자동 회전한다. */
  progress?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const TILE_COUNT = 12;
const tiles = Array.from({ length: TILE_COUNT }, (_, index) => {
  const angle = (index / TILE_COUNT) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.round(14.5 + Math.cos(angle) * 12), y: Math.round(14.5 + Math.sin(angle) * 12) };
});

function Tile({
  index,
  phase,
  refreshing,
  progress,
  tile,
}: {
  index: number;
  phase: SharedValue<number>;
  refreshing: boolean;
  progress: number;
  tile: { x: number; y: number };
}) {
  const color = useDerivedValue(() => {
    const head = Math.floor(phase.value * TILE_COUNT) % TILE_COUNT;
    const distance = (head - index + TILE_COUNT) % TILE_COUNT;
    if (!refreshing) return colors.SECONDARY_200;
    if (distance === 0) return colors.PRIMARY_300;
    if (distance === 1) return colors.SECONDARY_200;
    if (distance === 2) return colors.SECONDARY_300;
    return colors.SECONDARY_100;
  });
  const highlight = useDerivedValue(() => {
    const head = Math.floor(phase.value * TILE_COUNT) % TILE_COUNT;
    return refreshing && head === index ? 1 : 0;
  });
  const opacity = refreshing || index < Math.ceil(progress * TILE_COUNT) ? 1 : 0.2;

  return (
    <Group opacity={opacity}>
      <Rect x={tile.x} y={tile.y} width={3} height={3} color={color} />
      <Rect x={tile.x + 2} y={tile.y} width={1} height={1} color={colors.WHITE} opacity={highlight} />
    </Group>
  );
}

export function PixelLoadingSpinner({
  size = 32,
  refreshing = true,
  progress = 1,
  accessibilityLabel = '새로고침 중',
  style,
}: Props) {
  const phase = useLoadingLoop(refreshing, loadingMotion.circleCycle);
  const safeSize = Number.isFinite(size) ? Math.max(16, size) : 32;
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: refreshing }}
      style={[{ width: safeSize, height: safeSize }, style]}
    >
      <Canvas style={{ width: safeSize, height: safeSize }} pointerEvents="none">
        <Group transform={[{ scale: safeSize / 32 }]}>
          {tiles.map((tile, index) => (
            <Tile key={index} tile={tile} index={index} phase={phase} refreshing={refreshing} progress={safeProgress} />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}
