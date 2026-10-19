import { useEffect, useRef } from 'react';
import type { PaintSpan, Point } from '@sketch-catch/shared';
import { useRoomStore } from '@/shared/model/room';

const FLUSH_INTERVAL = 50; // ms

type Buffer = {
  strokeId: string;
  points: Point[];
} | null;

export function useStrokeSender(isDrawer: boolean) {
  const socket = useRoomStore(s => s.socket);
  const bufferRef = useRef<Buffer>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flush = (): void => {
    if (!bufferRef.current || bufferRef.current.points.length === 0) return;
    const { strokeId, points } = bufferRef.current;
    socket?.emit('stroke:append', { strokeId, points });
    bufferRef.current = { strokeId, points: [] };
  };

  const startStroke = (strokeId: string, color: string, width: number): void => {
    if (!isDrawer) return;
    socket?.emit('stroke:start', { strokeId, color, width });
    bufferRef.current = { strokeId, points: [] };
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(flush, FLUSH_INTERVAL);
  };

  const pushPoint = (p: Point): void => {
    if (!isDrawer || !bufferRef.current) return;
    bufferRef.current.points.push(p);
  };

  const endStroke = (): void => {
    if (!isDrawer) return;
    flush();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (bufferRef.current) {
      socket?.emit('stroke:end', { strokeId: bufferRef.current.strokeId });
      bufferRef.current = null;
    }
  };

  const undo = (): void => {
    if (!isDrawer) return;
    socket?.emit('stroke:undo');
  };

  const clear = (): void => {
    if (!isDrawer) return;
    socket?.emit('stroke:clear');
  };

  useEffect(() => {
    // cleanup on unmount — RESEARCH Pitfall 6
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const fill = (strokeId: string, color: string, paintSpans: PaintSpan[]): void => {
    if (isDrawer) socket?.emit('stroke:fill', { strokeId, color, paintSpans });
  };

  return { startStroke, pushPoint, endStroke, undo, clear, fill };
}
