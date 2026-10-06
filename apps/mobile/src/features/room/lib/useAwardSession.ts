import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { AWARD_DURATION_SEC, CLIENT_EVENT } from '@sketch-catch/shared';
import { useHardwareBack } from '@/shared/lib';
import { useRoomStore } from '@/shared/model';

/**
 * 시상식(모드1 award, 모드2 종료 화면) 공용 세션 — 카운트다운 + [한번 더!] / [나가기].
 * - 한번 더!: 서버에 room:rematch → 같은 방 대기실로 이동
 * - 나가기·카운트다운 만료·Android 뒤로가기: ROOM_LEAVE → 홈
 *
 * 카운트다운은 화면 진입 시점부터 로컬로 센다(기기 시계 오차로 서버보다 먼저 끝나지 않도록).
 * 실제 퇴장 처리는 서버 시상식 타이머가 진실의 출처다.
 */
export function useAwardSession(code: string, mode: 1 | 2) {
  const router = useRouter();
  const socket = useRoomStore((s) => s.socket);
  const durationSec = AWARD_DURATION_SEC[mode];
  const [secondsLeft, setSecondsLeft] = useState<number>(durationSec);
  const decidedRef = useRef(false);

  const exit = useCallback((): void => {
    if (decidedRef.current) return;
    decidedRef.current = true;
    socket?.emit(CLIENT_EVENT.ROOM_LEAVE);
    router.replace('/(tabs)' as never);
  }, [socket, router]);

  const rematch = useCallback((): void => {
    if (decidedRef.current) return;
    decidedRef.current = true;
    socket?.emit(CLIENT_EVENT.ROOM_REMATCH);
    router.replace(`/room/${code}` as never);
  }, [socket, router, code]);

  // Android 하드웨어 뒤로가기 = [나가기] (iOS 스와이프는 레이아웃에서 차단)
  useHardwareBack(exit);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const left = Math.max(0, durationSec - Math.floor((Date.now() - startedAt) / 1000));
      setSecondsLeft(left);
      if (left === 0) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [durationSec]);

  useEffect(() => {
    if (secondsLeft === 0) exit();
  }, [secondsLeft, exit]);

  return { secondsLeft, rematch, exit };
}
