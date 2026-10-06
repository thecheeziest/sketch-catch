import { colors } from '@/shared/config/theme';
import { loadingMotion, notebookCycle } from '@/shared/config/loadingMotion';
import { useLoadingLoop } from '@/shared/lib/useLoadingLoop';
import { Canvas, Group, Path, Rect, Skia } from '@shopify/react-native-skia';
import { View } from 'dripsy';
import { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';
import { createHandwriting } from './handwriting';

type Props = {
  size?: number;
  animating?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const writing = createHandwriting();
const rings = [48, 88, 128, 168, 208, 248];
const gridColumns = Array.from({ length: 12 }, (_, index) => 40 + index * 20);
const gridRows = Array.from({ length: 6 }, (_, index) => 76 + index * 20);
const pencilShape =
  'M 0 0 L 4 -14 L 12 -14 L 12 -20 L 34 -42 L 40 -42 L 40 -36 L 18 -14 L 14 -14 L 14 -6 L 6 -6 L 6 0 Z';

export function SketchbookLoadingSpinner({
  size = 240,
  animating = true,
  accessibilityLabel = '불러오는 중',
  style,
}: Props) {
  const phase = useLoadingLoop(animating, notebookCycle);
  const safeSize = Number.isFinite(size) ? Math.max(96, size) : 240;
  const height = (safeSize * 224) / 320;
  const path = useMemo(() => {
    // SkPath 직접 변경(moveTo/lineTo)은 Skia 2.6부터 deprecated — PathBuilder로 만든다
    const builder = Skia.PathBuilder.Make();
    writing.contours.forEach(points => {
      builder.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach(point => builder.lineTo(point.x, point.y));
    });
    return builder.build();
  }, []);
  const written = useDerivedValue(() =>
    Math.max(
      0,
      Math.min(1, (phase.value * notebookCycle - loadingMotion.notebookBlank) / loadingMotion.notebookWriting),
    ),
  );
  const pencilTransform = useDerivedValue(() => {
    const distance = written.value * writing.length;
    for (const segment of writing.segments) {
      if (distance <= segment.end) {
        const progress = Math.max(0, (distance - segment.start) / (segment.end - segment.start));
        return [
          { translateX: segment.from.x + (segment.to.x - segment.from.x) * progress },
          { translateY: segment.from.y + (segment.to.y - segment.from.y) * progress },
        ];
      }
    }
    const last = writing.segments[writing.segments.length - 1]?.to ?? { x: 70, y: 100 };
    return [{ translateX: last.x }, { translateY: last.y }];
  });
  const shine = useDerivedValue(() => {
    if (written.value < 1) return 0;
    const holdTime = phase.value * notebookCycle - loadingMotion.notebookBlank - loadingMotion.notebookWriting;
    return Math.floor(holdTime / loadingMotion.sparkleStep) % 2 === 0 ? 1 : 0.4;
  });

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: animating }}
      style={[{ width: safeSize, height }, style]}
    >
      <Canvas style={{ width: safeSize, height }} pointerEvents="none">
        <Group transform={[{ scale: safeSize / 320 }]}>
          {/* 스케치북 그림의 픽셀 외곽선. UI 컨테이너 테두리가 아닌 일러스트레이션이다. */}
          <Rect x={20} y={66} width={280} height={132} color={colors.PRIMARY_200} />
          <Rect x={28} y={58} width={264} height={148} color={colors.PRIMARY_200} />
          <Rect x={28} y={198} width={264} height={4} color={colors.PRIMARY_100} />
          <Rect x={20} y={62} width={280} height={128} color={colors.SECONDARY_300} />
          <Rect x={28} y={54} width={264} height={144} color={colors.SECONDARY_300} />
          <Rect x={24} y={62} width={272} height={128} color={colors.SECONDARY_100} />
          <Rect x={32} y={58} width={256} height={136} color={colors.SECONDARY_100} />
          <Rect x={28} y={66} width={264} height={120} color={colors.LIGHT_100} />
          <Rect x={36} y={62} width={248} height={128} color={colors.LIGHT_100} />
          <Group opacity={0.55}>
            {gridColumns.map(x => (
              <Rect key={x} x={x} y={62} width={1} height={128} color={colors.SECONDARY_100} />
            ))}
            {gridRows.map(y => (
              <Rect key={y} x={28} y={y} width={264} height={1} color={colors.SECONDARY_100} />
            ))}
          </Group>
          {rings.map(x => (
            <Group key={x}>
              <Rect x={x + 2} y={42} width={12} height={28} color={colors.SECONDARY_500} />
              <Rect x={x} y={38} width={12} height={28} color={colors.SECONDARY_300} />
              <Rect x={x + 2} y={38} width={8} height={4} color={colors.SECONDARY_200} />
              <Rect x={x + 2} y={42} width={3} height={18} color={colors.SECONDARY_100} />
              <Rect x={x + 5} y={44} width={3} height={16} color={colors.SECONDARY_500} />
            </Group>
          ))}
          <Path
            path={path}
            style="stroke"
            strokeWidth={3}
            strokeCap="square"
            strokeJoin="miter"
            color={colors.PRIMARY_300}
            end={written}
          />
          <Group transform={pencilTransform}>
            <Path path={pencilShape} color={colors.SECONDARY_500} />
            <Path path="M 8 -14 L 14 -20 L 30 -36 L 36 -36 L 16 -16 Z" color={colors.SECONDARY_200} />
            <Path path="M 10 -14 L 16 -14 L 32 -30 L 28 -34 Z" color={colors.SECONDARY_300} />
            <Path path="M 2 -4 L 6 -14 L 14 -8 L 6 -2 Z" color={colors.PRIMARY_100} />
            <Rect x={0} y={-4} width={4} height={4} color={colors.DARK_200} />
            <Path path="M 28 -38 L 34 -44 L 42 -36 L 36 -30 Z" color={colors.LIGHT_400} />
            <Path path="M 32 -42 L 38 -48 L 46 -40 L 40 -34 Z" color={colors.PRIMARY_200} />
            <Rect x={37} y={-44} width={4} height={3} color={colors.PRIMARY_100} />
          </Group>
          <Group opacity={shine}>
            <Path
              path="M 254 124 L 254 136 M 248 130 L 260 130 M 268 160 L 268 172 M 262 166 L 274 166"
              style="stroke"
              strokeWidth={2}
              color={colors.SECONDARY_200}
            />
            <Rect x={252} y={128} width={4} height={4} color={colors.WHITE} />
            <Rect x={266} y={164} width={4} height={4} color={colors.WHITE} />
          </Group>
        </Group>
      </Canvas>
    </View>
  );
}
