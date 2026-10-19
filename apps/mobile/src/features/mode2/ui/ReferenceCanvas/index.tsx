import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'dripsy';
import { type LayoutChangeEvent, StyleSheet } from 'react-native';
import { Canvas, Path, type SkPath } from '@shopify/react-native-skia';
import type { Stroke } from '@sketch-catch/shared';
import { colors, textSizes } from '@/shared/config';
import { buildPaintPath, buildStrokePath } from '@/shared/lib/strokePath';

type Props = {
  strokes: readonly Stroke[];
  /** 그림이 없을 때 가운데 안내 문구 */
  emptyLabel?: string;
};

type CachedPath = { path: SkPath; w: number; h: number };

// 읽기 전용 스케치북 — 정답 단계의 참고 그림, 정답 공개식의 스케치 과정 재생에 쓴다.
// DrawingCanvas는 useGameStore(모드1 전용) 기반이라 prop 주입이 불가능해 별도 렌더러로 구현.
// 재생 중에는 매 프레임 strokes가 바뀌므로, 다 그려진 stroke(같은 객체)의 경로는 캐시해 다시 만들지 않는다.
export function ReferenceCanvas({ strokes, emptyLabel }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const cacheRef = useRef(new WeakMap<Stroke, CachedPath>());

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  const getPath = (stroke: Stroke): SkPath | null => {
    const cached = cacheRef.current.get(stroke);
    if (cached && cached.w === size.width && cached.h === size.height) return cached.path;
    const path = stroke.paintSpans
      ? buildPaintPath(stroke.paintSpans, size.width, size.height)
      : buildStrokePath(stroke.points, size.width, size.height);
    if (path) cacheRef.current.set(stroke, { path, w: size.width, h: size.height });
    return path;
  };

  return (
    // Skia Canvas의 onLayout은 New Architecture에서 호출되지 않는다 — 감싼 View로 크기를 측정
    <View style={styles.body} onLayout={handleLayout} collapsable={false}>
      <Canvas style={StyleSheet.absoluteFill}>
        {size.width > 0 &&
          strokes.map(stroke => {
            const path = getPath(stroke);
            if (!path) return null;
            return (
              <Path
                key={stroke.id}
                path={path}
                color={stroke.color}
                strokeWidth={stroke.width <= 1 ? stroke.width * size.width : stroke.width}
                style={stroke.paintSpans ? 'fill' : 'stroke'}
                strokeCap="round"
                strokeJoin="round"
              />
            );
          })}
      </Canvas>
      {emptyLabel != null && strokes.length === 0 && (
        <View style={styles.empty} pointerEvents="none">
          <Text sx={{ ...textSizes.B2, color: colors.LIGHT_500, textAlign: 'center' }}>{emptyLabel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  empty: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
