import { useMemo } from 'react';
import { View } from 'dripsy';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, Picture, Skia, createPicture, type SkCanvas } from '@shopify/react-native-skia';
import Animated, { Easing, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { CURTAIN_PALETTE } from '../../config/pixelArt';
import { useCoverTransition, type CoverTransitionProps } from '../../lib/useCoverTransition';
import { CoverStatus } from '../CoverStatus';

const PIXEL = 6;
const EDGE_COLS = 6; // 앞단 곡선이 출렁이는 칸
const EDGE = EDGE_COLS * PIXEL;
const WAVE_AMPLITUDE = 5; // 곡선이 안쪽으로 들어가는 최대 칸 수
const WAVE_CYCLES = 1.25; // 화면 높이에 걸친 물결 수 — 작을수록 완만하다
const WAVE_PHASE = 1.2;
const VALANCE_ROWS = 6;
const SCALLOP = 6;

function drawCurtain(canvas: SkCanvas, width: number, height: number): void {
  const paint = Skia.Paint();
  const fill = (color: string, col: number, row: number, cols = 1, rows = 1): void => {
    paint.setColor(Skia.Color(color));
    canvas.drawRect(Skia.XYWHRect(col * PIXEL, row * PIXEL, cols * PIXEL, rows * PIXEL), paint);
  };
  const totalCols = Math.ceil(width / PIXEL);
  const totalRows = Math.ceil(height / PIXEL);
  const { folds, edge, valance, valanceShade } = CURTAIN_PALETTE;
  const foldAt = (col: number): string => folds[col % folds.length]!;

  // 몸판: 주름 색을 세로로 길게 칠한다
  for (let col = EDGE_COLS; col < totalCols; col++) fill(foldAt(col), col, 0, 1, totalRows);

  // 앞단: 화면 높이에 걸친 완만한 사인 곡선을 따라 밝은 가장자리 → 주름 순서로 채운다
  for (let row = 0; row < totalRows; row++) {
    const wave = Math.sin((row / totalRows) * Math.PI * 2 * WAVE_CYCLES + WAVE_PHASE);
    const indent = Math.round((WAVE_AMPLITUDE * (1 + wave)) / 2);
    fill(edge, indent, row);
    for (let col = indent + 1; col < EDGE_COLS; col++) fill(foldAt(col), col, row);
  }

  // 윗단 장식(밸런스): 짙은 띠 + 아랫줄 음영 + 반원 물결 밑단
  fill(valance, EDGE_COLS, 0, totalCols - EDGE_COLS, VALANCE_ROWS);
  fill(valanceShade, EDGE_COLS, VALANCE_ROWS - 1, totalCols - EDGE_COLS, 1);
  for (let col = EDGE_COLS; col < totalCols; col += SCALLOP) {
    fill(valance, col + 1, VALANCE_ROWS, SCALLOP - 2, 1);
    fill(valance, col + 2, VALANCE_ROWS + 1, SCALLOP - 4, 1);
  }
}

// 샵 → 옷장 전환: 픽셀 커튼이 오른쪽에서 왼쪽으로 닫혔다가 다시 오른쪽으로 걷힌다.
// startCovered면 닫힌 채로 시작해 ready가 될 때까지 기다린다 (옷장 진입 로딩)
export function CurtainTransition({ startCovered, ready, onCovered, onDone, children }: CoverTransitionProps) {
  const { width, height } = useWindowDimensions();
  const curtainWidth = width + EDGE;
  const picture = useMemo(
    () => createPicture(canvas => drawCurtain(canvas, curtainWidth, height), { width: curtainWidth, height }),
    [curtainWidth, height],
  );
  const progress = useCoverTransition({
    sound: 'curtain',
    coverMs: 650,
    holdMs: 140,
    revealMs: 650,
    coverEasing: Easing.out(Easing.cubic),
    revealEasing: Easing.in(Easing.cubic),
    startCovered,
    ready,
    onCovered,
    onDone,
  });

  // 닫힌 상태에서는 물결 앞단을 화면 왼쪽 밖으로 밀어 몸판이 화면 전체를 덮게 한다
  const curtainStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1, 2], [width, -EDGE, width]) }],
  }));

  return (
    <View pointerEvents="auto" style={[StyleSheet.absoluteFill, styles.root]}>
      <Animated.View style={[{ width: curtainWidth, height }, curtainStyle]}>
        <Canvas style={{ width: curtainWidth, height }}>
          <Picture picture={picture} />
        </Canvas>
      </Animated.View>
      <CoverStatus progress={progress}>{children}</CoverStatus>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 10, overflow: 'hidden' },
});
