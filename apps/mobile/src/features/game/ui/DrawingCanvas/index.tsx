import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useAppDimensions } from '@/shared/lib/useAppDimensions';
import { Canvas, Path, Picture, Skia } from '@shopify/react-native-skia';
import { View } from 'dripsy';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import type { SkPath } from '@shopify/react-native-skia';
import type { PaintSpan, Point, Stroke } from '@sketch-catch/shared';
import { colors } from '@/shared/config';
import { useGameStore } from '@/features/game/model/useGameStore';
import { useShallow } from 'zustand/react/shallow';
import { useStrokeSender } from '@/features/game/api/useStrokeSender';
import { useAuthStore } from '@/shared/model/auth';
import { createPaintSpans } from '@/features/game/lib/paint';
import { useToastStore } from '@/shared/model/toast';
import { playFeedback } from '@/shared/lib/feedback';
import { buildPaintPath, buildStrokePath, createStrokesPicture, toCanvasStrokeWidth } from '@/shared/lib/strokePath';
const EMPTY_PATH = Skia.Path.Make();

// 간단한 클라이언트용 stroke ID 생성 (서버가 authorId를 덮어쓰므로 충돌 무관)
function makeStrokeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type LocalStroke = {
  strokeId: string;
  color: string;
  width: number;
  startTime: number;
  paintSpans?: PaintSpan[];
  points: Point[]; // 정규화 좌표 (0~1) — 렌더 시 캔버스 크기로 역정규화
};

type Props = {
  isDrawer: boolean;
  drawingEnabled?: boolean;
  onTouchCanvas?: () => void;
  // 모드2 DRAW 단계 제출용 — stroke 종료마다 지금까지 그린 전체 strokes를 전달 (선택적, mode1은 미사용)
  onStrokesChange?: (strokes: Stroke[]) => void;
};

export function DrawingCanvas({ isDrawer, drawingEnabled = isDrawer, onStrokesChange, onTouchCanvas }: Props) {
  // 채팅·타이머 등 다른 게임 상태가 바뀔 때마다 캔버스가 다시 그려지지 않도록 필요한 필드만 구독한다
  const { remoteStrokes } = useGameStore(
    useShallow(s => ({
      remoteStrokes: s.remoteStrokes,
    })),
  );
  const sender = useStrokeSender(isDrawer && !onStrokesChange);
  const myId = useAuthStore(s => s.user?.id) ?? '';

  // 캔버스 크기 (onLayout으로 측정). 일부 시뮬레이터/기기에서 onLayout이 늦거나 0을 주는
  // 경우가 있어, 그때는 창 크기 기반 근사값을 fallback으로 써서 캔버스가 blank로 남지 않게 한다.
  // 실제 측정값이 들어오면 크기 시그니처 캐시가 경로를 재생성한다.
  const win = useAppDimensions();
  const fallbackW = Math.max(1, Math.round(win.width));
  const fallbackH = Math.max(1, Math.round(win.width * 1.1));
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // 출제자 로컬 stroke 목록 (본인에게는 stroke:remote가 오지 않으므로 별도 관리).
  // 다 그린 획만 state로 두고 Picture 한 장으로 굳힌다 — 그리는 중인 획은 리렌더 없이 currentPath로만 갱신
  const [localStrokes, setLocalStrokes] = useState<LocalStroke[]>([]);
  const [activeStyle, setActiveStyle] = useState<{ color: string; width: number } | null>(null);
  const currentPath = useSharedValue<SkPath>(EMPTY_PATH);
  const currentStrokeRef = useRef<LocalStroke | null>(null);
  const allStrokesRef = useRef<LocalStroke[]>([]);
  const canvasStartedAt = useRef(Date.now());

  const toSharedStroke = (s: LocalStroke): Stroke => ({
    id: s.strokeId,
    authorId: myId,
    color: s.color,
    width: s.width / (canvasSizeRef.current.width || fallbackW),
    points: s.points.map(point => ({ ...point, t: point.t - canvasStartedAt.current })),
    paintSpans: s.paintSpans,
    startTime: s.startTime - canvasStartedAt.current,
  });

  const inputRef = useRef({
    drawingEnabled,
    isDrawer,
    onTouchCanvas,
    onStrokesChange,
    sender,
    toSharedStroke,
    fallbackW,
    fallbackH,
  });
  inputRef.current = {
    drawingEnabled,
    isDrawer,
    onTouchCanvas,
    onStrokesChange,
    sender,
    toSharedStroke,
    fallbackW,
    fallbackH,
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onBegin(e => {
          inputRef.current.onTouchCanvas?.();
          if (!inputRef.current.drawingEnabled) return;
          const { color, width, eraser, paint } = useGameStore.getState();
          const cw = canvasSizeRef.current.width || inputRef.current.fallbackW;
          const ch = canvasSizeRef.current.height || inputRef.current.fallbackH;

          if (paint) {
            try {
              const paintSpans = createPaintSpans(allStrokesRef.current, cw, ch, e.x, e.y, color);
              if (paintSpans.length === 0) return;
              const fillStroke: LocalStroke = {
                strokeId: makeStrokeId(),
                color,
                width: 0,
                startTime: Date.now(),
                points: [],
                paintSpans,
              };
              allStrokesRef.current = [...allStrokesRef.current, fillStroke];
              setLocalStrokes(allStrokesRef.current);
              inputRef.current.sender.fill(fillStroke.strokeId, color, paintSpans);
              playFeedback('fill');
              inputRef.current.onStrokesChange?.(allStrokesRef.current.map(inputRef.current.toSharedStroke));
            } catch (error) {
              useToastStore
                .getState()
                .show(error instanceof Error ? error.message : '페인트를 칠하지 못했어요!', 'error');
            }
            return;
          }

          const strokeId = makeStrokeId();
          const strokeColor = eraser ? '#FFFFFF' : color;
          const strokeWidth = eraser ? width * 2 : width;

          const point: Point = {
            x: e.x / cw,
            y: e.y / ch,
            t: Date.now(),
          };
          const stroke: LocalStroke = {
            strokeId,
            color: strokeColor,
            width: strokeWidth,
            startTime: point.t,
            points: [point],
          };
          currentStrokeRef.current = stroke;
          currentPath.value = buildStrokePath(stroke.points, cw, ch) ?? EMPTY_PATH;
          setActiveStyle({ color: strokeColor, width: strokeWidth });

          // 관전자 기기의 캔버스 크기가 달라도 같은 두께로 보이도록 캔버스 너비 대비 비율로 보낸다
          inputRef.current.sender.startStroke(strokeId, strokeColor, strokeWidth / cw);
          inputRef.current.sender.pushPoint(point);
        })
        .onUpdate(e => {
          if (!inputRef.current.drawingEnabled || !currentStrokeRef.current) return;
          const cw = canvasSizeRef.current.width || inputRef.current.fallbackW;
          const ch = canvasSizeRef.current.height || inputRef.current.fallbackH;

          const point: Point = {
            x: e.x / cw,
            y: e.y / ch,
            t: Date.now(),
          };
          currentStrokeRef.current.points.push(point);
          // 리렌더 없이 그리는 중인 획만 갱신 — Skia가 공유 값 변경을 감지해 다시 그린다
          currentPath.value = buildStrokePath(currentStrokeRef.current.points, cw, ch) ?? EMPTY_PATH;

          inputRef.current.sender.pushPoint(point);
        })
        .onEnd(() => {
          if (!currentStrokeRef.current) return;
          inputRef.current.sender.endStroke();
          allStrokesRef.current = [...allStrokesRef.current, currentStrokeRef.current];
          currentStrokeRef.current = null;
          setLocalStrokes(allStrokesRef.current);
          setActiveStyle(null);
          currentPath.value = EMPTY_PATH;
          inputRef.current.onStrokesChange?.(allStrokesRef.current.map(inputRef.current.toSharedStroke));
        }),
    [currentPath],
  );

  const handleLayout = useCallback((e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    canvasSizeRef.current = { width: w, height: h };
    setCanvasSize({ width: w, height: h });
  }, []);

  // 클릭 신호가 바뀐 순간에만 처리한다. 리렌더·콜백 변경·이전 단계 nonce로 다시 지우지 않는다.
  useEffect(
    () =>
      useGameStore.subscribe((state, previous) => {
        if (!inputRef.current.isDrawer) return;
        const cleared = state.drawerClearNonce !== previous.drawerClearNonce;
        const undoCount = Math.max(0, state.drawerUndoNonce - previous.drawerUndoNonce);
        if (!cleared && undoCount === 0) return;
        inputRef.current.sender.endStroke();
        // 그리는 중인 획은 아직 목록에 없으므로 되돌리기 1회는 그 획을 버리는 것으로 쓴다
        const pendingUndo = currentStrokeRef.current ? undoCount - 1 : undoCount;
        const keepCount = cleared ? 0 : Math.max(0, allStrokesRef.current.length - pendingUndo);
        allStrokesRef.current = allStrokesRef.current.slice(0, keepCount);
        currentStrokeRef.current = null;
        setLocalStrokes(allStrokesRef.current);
        setActiveStyle(null);
        currentPath.value = EMPTY_PATH;
        inputRef.current.onStrokesChange?.(allStrokesRef.current.map(inputRef.current.toSharedStroke));
      }),
    [currentPath],
  );

  const cw = canvasSize.width || fallbackW;
  const ch = canvasSize.height || fallbackH;

  // 출제자: 다 그린 획은 획이 끝나거나 되돌릴 때만 Picture로 다시 굳힌다
  const localPicture = useMemo(
    () => (isDrawer ? createStrokesPicture(localStrokes, cw, ch) : null),
    [isDrawer, localStrokes, cw, ch],
  );

  // 관전자: 끝난 획은 Picture로 굳히고, 아직 그려지는 획만 Path로 매 수신마다 갱신한다
  const endedRemote = useStableEndedStrokes(remoteStrokes);
  const remotePicture = useMemo(
    () => (isDrawer ? null : createStrokesPicture(endedRemote, cw, ch)),
    [isDrawer, endedRemote, cw, ch],
  );
  const activeRemote = isDrawer ? [] : remoteStrokes.filter(rs => !rs.ended);

  return (
    <GestureDetector gesture={pan}>
      {/* Skia Canvas의 onLayout은 New Architecture에서 호출되지 않는다 — 감싼 View로 크기를 측정 */}
      <View
        style={[styles.canvas, { backgroundColor: '#FFFFFF' }]}
        onLayout={handleLayout}
        onTouchStart={onTouchCanvas}
      >
        <Canvas style={StyleSheet.absoluteFill}>
          {localPicture && <Picture picture={localPicture} />}
          {isDrawer && activeStyle && (
            <Path
              path={currentPath}
              color={activeStyle.color}
              strokeWidth={activeStyle.width}
              style="stroke"
              strokeCap="round"
              strokeJoin="round"
            />
          )}
          {remotePicture && <Picture picture={remotePicture} />}
          {activeRemote.map(rs => {
            const path = rs.paintSpans ? buildPaintPath(rs.paintSpans, cw, ch) : buildStrokePath(rs.points, cw, ch);
            if (!path) return null;
            return (
              <Path
                key={rs.strokeId}
                path={path}
                color={rs.color}
                strokeWidth={toCanvasStrokeWidth(rs.width, cw)}
                style={rs.paintSpans ? 'fill' : 'stroke'}
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

// 끝난 획 목록이 실제로 바뀔 때만 새 배열을 돌려준다 — 진행 중인 획의 좌표 수신마다 Picture를 다시 만들지 않기 위함
function useStableEndedStrokes<T extends { ended: boolean }>(strokes: readonly T[]): readonly T[] {
  const ref = useRef<readonly T[]>([]);
  const ended = strokes.filter(s => s.ended);
  const prev = ref.current;
  const same = prev.length === ended.length && ended.every((s, i) => s === prev[i]);
  if (!same) ref.current = ended;
  return ref.current;
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    width: '100%',
  },
});
