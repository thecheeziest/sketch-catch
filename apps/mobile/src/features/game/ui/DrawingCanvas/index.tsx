import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, Path } from '@shopify/react-native-skia';
import { View } from 'dripsy';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { SkPath } from '@shopify/react-native-skia';
import type { Point, Stroke } from '@sketch-catch/shared';
import { colors } from '@/shared/config';
import { useGameStore } from '@/features/game/model/useGameStore';
import { useStrokeSender } from '@/features/game/api/useStrokeSender';
import { useAuthStore } from '@/shared/model/auth';
import { buildStrokePath } from '@/shared/lib/strokePath';
// 간단한 클라이언트용 stroke ID 생성 (서버가 authorId를 덮어쓰므로 충돌 무관)
function makeStrokeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type LocalStroke = {
  strokeId: string;
  color: string;
  width: number;
  points: Point[]; // 정규화 좌표 (0~1) — 렌더 시 캔버스 크기로 역정규화
};

type Props = {
  isDrawer: boolean;
  // 모드2 DRAW 단계 제출용 — stroke 종료마다 지금까지 그린 전체 strokes를 전달 (선택적, mode1은 미사용)
  onStrokesChange?: (strokes: Stroke[]) => void;
};

export function DrawingCanvas({ isDrawer, onStrokesChange }: Props) {
  const { color, width, eraser, remoteStrokes } = useGameStore();
  const drawerClearNonce = useGameStore((s) => s.drawerClearNonce);
  const drawerUndoNonce = useGameStore((s) => s.drawerUndoNonce);
  const sender = useStrokeSender(isDrawer);
  const myId = useAuthStore((s) => s.user?.id) ?? '';

  // 캔버스 크기 (onLayout으로 측정). 일부 시뮬레이터/기기에서 onLayout이 늦거나 0을 주는
  // 경우가 있어, 그때는 창 크기 기반 근사값을 fallback으로 써서 캔버스가 blank로 남지 않게 한다.
  // 실제 측정값이 들어오면 크기 시그니처 캐시가 경로를 재생성한다.
  const win = useWindowDimensions();
  const fallbackW = Math.max(1, Math.round(win.width));
  const fallbackH = Math.max(1, Math.round(win.width * 1.1));
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // 출제자 로컬 stroke 목록 (본인에게는 stroke:remote가 오지 않으므로 별도 관리)
  const [localStrokes, setLocalStrokes] = useState<LocalStroke[]>([]);
  const currentStrokeRef = useRef<LocalStroke | null>(null);
  const allStrokesRef = useRef<LocalStroke[]>([]);

  const toSharedStroke = (s: LocalStroke): Stroke => ({
    id: s.strokeId,
    authorId: myId,
    color: s.color,
    width: s.width,
    points: s.points,
    startTime: s.points[0]?.t ?? Date.now(),
  });

  const getStrokeColor = (): string => (eraser ? '#FFFFFF' : color);
  const getStrokeWidth = (): number => (eraser ? width * 2 : width);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => {
      if (!isDrawer) return;
      const cw = canvasSizeRef.current.width || fallbackW;
      const ch = canvasSizeRef.current.height || fallbackH;

      const strokeId = makeStrokeId();
      const strokeColor = getStrokeColor();
      const strokeWidth = getStrokeWidth();

      const point: Point = {
        x: e.x / cw,
        y: e.y / ch,
        t: Date.now(),
      };
      const stroke: LocalStroke = { strokeId, color: strokeColor, width: strokeWidth, points: [point] };
      currentStrokeRef.current = stroke;
      allStrokesRef.current = [...allStrokesRef.current, stroke];
      setLocalStrokes(allStrokesRef.current);

      sender.startStroke(strokeId, strokeColor, strokeWidth);
      sender.pushPoint(point);
    })
    .onUpdate((e) => {
      if (!isDrawer || !currentStrokeRef.current) return;
      const cw = canvasSizeRef.current.width || fallbackW;
      const ch = canvasSizeRef.current.height || fallbackH;

      const point: Point = {
        x: e.x / cw,
        y: e.y / ch,
        t: Date.now(),
      };
      currentStrokeRef.current.points.push(point);
      // 새 배열 참조로 재렌더 유도 — 렌더에서 points로부터 SkPath를 새로 만든다
      setLocalStrokes((prev) => [...prev]);

      sender.pushPoint(point);
    })
    .onEnd(() => {
      if (!isDrawer) return;
      sender.endStroke();
      currentStrokeRef.current = null;
      onStrokesChange?.(allStrokesRef.current.map(toSharedStroke));
    });

  const handleLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const { width: w, height: h } = e.nativeEvent.layout;
      canvasSizeRef.current = { width: w, height: h };
      setCanvasSize({ width: w, height: h });
    },
    []
  );

  // 출제자 로컬 stroke도 strokeId별 SkPath를 캐시 — 매 프레임 전체 재생성 방지.
  // skia는 같은 참조의 제자리 변경을 리페인트하지 않으므로, point가 늘었거나 캔버스 크기가
  // 바뀌면(레이아웃 측정 전 0×0으로 만들어진 경로 복구 포함) 새 SkPath로 교체한다.
  const localPathCache = useRef<Map<string, { path: SkPath; count: number; w: number; h: number }>>(new Map());

  const getLocalPath = (s: LocalStroke, w: number, h: number): SkPath | null => {
    const cached = localPathCache.current.get(s.strokeId);
    if (cached && cached.count === s.points.length && cached.w === w && cached.h === h) return cached.path;
    const p = buildStrokePath(s.points, w, h);
    if (!p) return null;
    localPathCache.current.set(s.strokeId, { path: p, count: s.points.length, w, h });
    return p;
  };

  // 출제자: '전체 지우기'/'되돌리기'는 서버 broadcast에서 sender가 제외되므로,
  // 스토어 nonce를 구독해 로컬 stroke도 함께 정리한다. nonce 0(초기값)에는 무시.
  useEffect(() => {
    if (!isDrawer || drawerClearNonce === 0) return;
    allStrokesRef.current = [];
    currentStrokeRef.current = null;
    localPathCache.current.clear();
    setLocalStrokes([]);
  }, [isDrawer, drawerClearNonce]);

  useEffect(() => {
    if (!isDrawer || drawerUndoNonce === 0) return;
    const removed = allStrokesRef.current[allStrokesRef.current.length - 1];
    if (removed) localPathCache.current.delete(removed.strokeId);
    allStrokesRef.current = allStrokesRef.current.slice(0, -1);
    currentStrokeRef.current = null;
    setLocalStrokes(allStrokesRef.current);
  }, [isDrawer, drawerUndoNonce]);

  // 관전자: remoteStrokes를 Skia Path로 변환 (strokeId별 누적 — 매 프레임 재생성 금지).
  // RESEARCH Pitfall 4: strokeId별 Path Map 누적. 단, 경로가 만들어진 캔버스 크기(w/h)를
  // 함께 기록해, 레이아웃 측정 전 0×0으로 만들어진 경로가 캐시에 굳는 문제를 막는다.
  const remotePathCache = useRef<Map<string, { path: SkPath; count: number; w: number; h: number }>>(new Map());

  // 제거된 stroke 캐시 정리
  const currentRemoteIds = new Set(remoteStrokes.map((s) => s.strokeId));
  for (const id of remotePathCache.current.keys()) {
    if (!currentRemoteIds.has(id)) remotePathCache.current.delete(id);
  }

  // points 업데이트: remoteStrokes 순회.
  // point가 늘거나 캔버스 크기가 바뀐 stroke만 새 SkPath로 교체 — 제자리 변경은 skia가
  // 리페인트하지 않으므로 in-place lineTo 대신 항상 새 객체를 만든다(변하는 건 진행 중 1개).
  const cw = canvasSize.width || fallbackW;
  const ch = canvasSize.height || fallbackH;
  if (cw > 0 && ch > 0) {
    for (const rs of remoteStrokes) {
      const cached = remotePathCache.current.get(rs.strokeId);
      if (cached && cached.count === rs.points.length && cached.w === cw && cached.h === ch) continue;
      const p = buildStrokePath(rs.points, cw, ch);
      if (!p) continue;
      remotePathCache.current.set(rs.strokeId, { path: p, count: rs.points.length, w: cw, h: ch });
    }
  }

  return (
    <GestureDetector gesture={pan}>
      {/* Skia Canvas의 onLayout은 New Architecture에서 호출되지 않는다 — 감싼 View로 크기를 측정 */}
      <View style={[styles.canvas, { backgroundColor: '#FFFFFF' }]} onLayout={handleLayout}>
        <Canvas style={StyleSheet.absoluteFill}>
          {/* 출제자 로컬 stroke — skia는 같은 SkPath 참조의 제자리 변경을 리페인트하지 않으므로
              point가 늘어난 stroke는 새 SkPath로 교체(getLocalPath) */}
          {isDrawer && cw > 0 && ch > 0 && localStrokes.map((s) => {
            const p = getLocalPath(s, cw, ch);
            if (!p) return null;
            return (
              <Path
                key={s.strokeId}
                path={p}
                color={s.color}
                strokeWidth={s.width}
                style="stroke"
                strokeCap="round"
                strokeJoin="round"
              />
            );
          })}
          {/* 관전자 remote stroke */}
          {!isDrawer && cw > 0 && ch > 0 && remoteStrokes.map((rs) => {
            const cached = remotePathCache.current.get(rs.strokeId);
            if (!cached) return null;
            return (
              <Path
                key={rs.strokeId}
                path={cached.path}
                color={rs.color}
                strokeWidth={rs.width}
                style="stroke"
                strokeCap="round"
                strokeJoin="round"
              />
            );
          })}
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    width: '100%',
  },
});
