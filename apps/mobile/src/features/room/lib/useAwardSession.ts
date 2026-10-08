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
 * 서버 종료 시각을 기준으로 표시하고, 서버 만료 이벤트로도 퇴장을 보장한다.
 * 실제 퇴장 처리는 서버 시상식 타이머가 진실의 출처다.
 */
export function useAwardSession(code: string, mode: 1 | 2) {
  const router = useRouter();
  const socket = useRoomStore(s => s.socket);
  const durationSec = AWARD_DURATION_SEC[mode];
  const awardEndsAt = useRoomStore(s => s.roomState?.awardEndsAt);
  const [secondsLeft, setSecondsLeft] = useState<number>(durationSec);
  const decidedRef = useRef(false);

  const exit = useCallback((): void => {
    if (decidedRef.current) return;
    decidedRef.current = true;
    socket?.emit(CLIENT_EVENT.ROOM_LEAVE);
    router.replace('/(tabs)/' as never);
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
      const end = awardEndsAt ?? startedAt + durationSec * 1000;
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [durationSec, awardEndsAt]);

  useEffect(() => {
    if (secondsLeft === 0) exit();
  }, [secondsLeft, exit]);

  useEffect(() => {
    const onRemoved = (payload: { code: string }): void => {
      if (payload.code === code) exit();
    };
    socket?.on('room:removed', onRemoved);
    return () => {
      socket?.off('room:removed', onRemoved);
    };
  }, [socket, code, exit]);

  return { secondsLeft, rematch, exit };
}
