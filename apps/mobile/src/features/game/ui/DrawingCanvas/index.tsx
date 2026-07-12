import { useCallback, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { SkPath } from '@shopify/react-native-skia';
import type { Point, Stroke } from '@sketch-catch/shared';
import { colors } from '@/shared/config';
import { useGameStore } from '@/features/game/model/useGameStore';
import { useStrokeSender } from '@/features/game/api/useStrokeSender';
import { useAuthStore } from '@/shared/model/auth';
// 간단한 클라이언트용 stroke ID 생성 (서버가 authorId를 덮어쓰므로 충돌 무관)
function makeStrokeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type LocalStroke = {
  strokeId: string;
  path: SkPath;
  color: string;
  width: number;
  points: Point[];
};

type Props = {
  isDrawer: boolean;
  // 모드2 DRAW 단계 제출용 — stroke 종료마다 지금까지 그린 전체 strokes를 전달 (선택적, mode1은 미사용)
  onStrokesChange?: (strokes: Stroke[]) => void;
};

export function DrawingCanvas({ isDrawer, onStrokesChange }: Props) {
  const { color, width, eraser, remoteStrokes } = useGameStore();
  const sender = useStrokeSender(isDrawer);
  const myId = useAuthStore((s) => s.user?.id) ?? '';

  // 캔버스 크기 (onLayout으로 측정)
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
      const { width: cw, height: ch } = canvasSizeRef.current;
      if (cw === 0 || ch === 0) return;

      const strokeId = makeStrokeId();
      const strokeColor = getStrokeColor();
      const strokeWidth = getStrokeWidth();

      const path = Skia.Path.Make();
      path.moveTo(e.x, e.y);

      const point: Point = {
        x: e.x / cw,
        y: e.y / ch,
        t: Date.now(),
      };
      const stroke: LocalStroke = { strokeId, path, color: strokeColor, width: strokeWidth, points: [point] };
      currentStrokeRef.current = stroke;
      allStrokesRef.current = [...allStrokesRef.current, stroke];
      setLocalStrokes(allStrokesRef.current);

      sender.startStroke(strokeId, strokeColor, strokeWidth);
      sender.pushPoint(point);
    })
    .onUpdate((e) => {
      if (!isDrawer || !currentStrokeRef.current) return;
      const { width: cw, height: ch } = canvasSizeRef.current;
      if (cw === 0 || ch === 0) return;

      currentStrokeRef.current.path.lineTo(e.x, e.y);
      const point: Point = {
        x: e.x / cw,
        y: e.y / ch,
        t: Date.now(),
      };
      currentStrokeRef.current.points.push(point);
      // force re-render by creating new array reference
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

  // 관전자: remoteStrokes를 Skia Path로 변환 (strokeId별 누적 — 매 프레임 재생성 금지)
  // RESEARCH Pitfall 4: strokeId별 Path Map 누적, 재생성 금지
  const remotePathCache = useRef<Map<string, SkPath>>(new Map());
  const remotePointCountCache = useRef<Map<string, number>>(new Map());

  // 제거된 stroke 캐시 정리
  const currentRemoteIds = new Set(remoteStrokes.map((s) => s.strokeId));
  for (const id of remotePathCache.current.keys()) {
    if (!currentRemoteIds.has(id)) {
      remotePathCache.current.delete(id);
      remotePointCountCache.current.delete(id);
    }
  }

  // points 업데이트: remoteStrokes 순회
  const { width: cw, height: ch } = canvasSize;
  for (const rs of remoteStrokes) {
    const existingPath = remotePathCache.current.get(rs.strokeId);
    const existingCount = remotePointCountCache.current.get(rs.strokeId) ?? 0;
    if (!existingPath) {
      if (rs.points.length === 0) continue;
      const p = Skia.Path.Make();
      const first = rs.points[0];
      if (first) {
        p.moveTo(first.x * cw, first.y * ch);
        for (let i = 1; i < rs.points.length; i++) {
          const pt = rs.points[i];
          if (pt) p.lineTo(pt.x * cw, pt.y * ch);
        }
      }
      remotePathCache.current.set(rs.strokeId, p);
      remotePointCountCache.current.set(rs.strokeId, rs.points.length);
    } else if (rs.points.length > existingCount) {
      for (let i = existingCount; i < rs.points.length; i++) {
        const pt = rs.points[i];
        if (pt) existingPath.lineTo(pt.x * cw, pt.y * ch);
      }
      remotePointCountCache.current.set(rs.strokeId, rs.points.length);
    }
  }

  return (
    <GestureDetector gesture={pan}>
      <Canvas
        style={[styles.canvas, { backgroundColor: '#FFFFFF' }]}
        onLayout={handleLayout}
      >
        {/* 출제자 로컬 stroke */}
        {isDrawer && localStrokes.map((s) => (
          <Path
            key={s.strokeId}
            path={s.path}
            color={s.color}
            strokeWidth={s.width}
            style="stroke"
            strokeCap="round"
            strokeJoin="round"
          />
        ))}
        {/* 관전자 remote stroke */}
        {!isDrawer && remoteStrokes.map((rs) => {
          const p = remotePathCache.current.get(rs.strokeId);
          if (!p) return null;
          return (
            <Path
              key={rs.strokeId}
              path={p}
              color={rs.color}
              strokeWidth={rs.width}
              style="stroke"
              strokeCap="round"
              strokeJoin="round"
            />
          );
        })}
      </Canvas>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    width: '100%',
  },
});
