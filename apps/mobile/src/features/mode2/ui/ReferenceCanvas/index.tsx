import { useCallback, useState } from 'react';
import { Text, View } from 'dripsy';
import { type LayoutChangeEvent, StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, Path } from '@shopify/react-native-skia';
import type { Stroke } from '@sketch-catch/shared';
import { colors, textSizes } from '@/shared/config';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { buildStrokePath } from '@/shared/lib/strokePath';

type Props = {
  strokes: Stroke[];
};

// ANSWER 단계 참고용 — 이전 DRAW 단계 stroke를 읽기 전용으로 렌더.
// DrawingCanvas는 useGameStore(모드1 전용) 기반이라 prop 주입이 불가능해 별도 렌더러로 구현.
export function ReferenceCanvas({ strokes }: Props) {
  const { height: screenHeight } = useWindowDimensions();
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvasSize({ width, height });
  }, []);

  return (
    <View sx={{ height: screenHeight * 0.4 }}>
      {/* 고정 높이 컨테이너 — 테두리는 absoluteFill, 실제 콘텐츠는 형제 노드(normal flow)로 배치 */}
      <PixelFrame borderColor={colors.SECONDARY_300} style={StyleSheet.absoluteFill}>
        <View style={StyleSheet.absoluteFill} />
      </PixelFrame>
      <View style={styles.body} onLayout={handleLayout}>
        <Canvas style={styles.canvas}>
          {canvasSize.width > 0 &&
            strokes.map((s) => {
              const path = buildStrokePath(s.points, canvasSize.width, canvasSize.height);
              if (!path) return null;
              return (
                <Path
                  key={s.id}
                  path={path}
                  color={s.color}
                  strokeWidth={s.width}
                  style="stroke"
                  strokeCap="round"
                  strokeJoin="round"
                />
              );
            })}
        </Canvas>
        <View style={styles.labelBar}>
          <Text sx={{ ...textSizes.T3, fontFamily: 'Galmuri11', color: colors.LIGHT_100, textAlign: 'center' }}>
            이 그림은 뭘까요?
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  canvas: {
    flex: 1,
  },
  labelBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 6,
    backgroundColor: 'rgba(12, 10, 22, 0.75)',
  },
});
