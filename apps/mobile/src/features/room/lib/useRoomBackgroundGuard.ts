import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { isGameInProgressStatus, OFFLINE_GRACE_SEC } from '@sketch-catch/shared';
import { useRoomStore, useToastStore } from '@/shared/model';

const GRACE_MS = OFFLINE_GRACE_SEC * 1000;
// 게임 화면에서 이 오류로 재입장이 거절되면 더 이상 이어서 할 수 없으므로 홈으로 보낸다
const SEAT_LOST_CODES = new Set(['ALREADY_LEFT', 'ROOM_NOT_FOUND']);

/**
 * 게임 중 앱이 백그라운드로 가면 방 소켓을 끊어 서버의 자리 유예(30초)를 시작한다.
 * Android는 백그라운드에서도 JS가 돌아 연결이 유지되므로, 끊지 않으면 자리를 비운 채 게임에 남는다.
 * - 30초 안에 돌아오면 다시 연결 → 서버가 현재 라운드·그림·채팅을 다시 보내 그대로 이어서 한다.
 * - 30초 이상이면 서버가 이미 퇴장 처리했으므로 안내와 함께 홈으로 돌아간다.
 */
export function useRoomBackgroundGuard(code: string | undefined): void {
  const router = useRouter();
  const joinError = useRoomStore(s => s.joinError);
  const status = useRoomStore(s => s.roomState?.status);
  const backgroundAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!code) return;
    const subscription = AppState.addEventListener('change', next => {
      const { socket, roomCode, roomState } = useRoomStore.getState();
      if (roomCode !== code || !socket) return;

      if (next === 'background') {
        if (!roomState || !isGameInProgressStatus(roomState.status)) return;
        backgroundAtRef.current = Date.now();
        socket.disconnect();
        return;
      }
      if (next !== 'active' || backgroundAtRef.current === null) return;

      const awayMs = Date.now() - backgroundAtRef.current;
      backgroundAtRef.current = null;
      if (awayMs >= GRACE_MS) {
        useToastStore.getState().show('장시간 참여하지 않아 홈으로 돌아왔어요!', 'info');
        router.replace('/(tabs)/' as never);
        return;
      }
      socket.connect();
    });
    return () => subscription.remove();
  }, [code, router]);

  // 네트워크가 오래 끊겼다 재연결된 경우 등 — 게임 중 재입장이 거절되면 마지막 화면에 멈추지 않고 홈으로 (안내는 소켓 오류 토스트)
  useEffect(() => {
    if (!joinError || !SEAT_LOST_CODES.has(joinError.code)) return;
    if (!status || !isGameInProgressStatus(status)) return;
    router.replace('/(tabs)/' as never);
  }, [joinError, status, router]);
}
