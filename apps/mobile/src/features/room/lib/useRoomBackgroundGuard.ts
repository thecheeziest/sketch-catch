import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { isGameInProgressStatus, OFFLINE_GRACE_SEC } from '@sketch-catch/shared';
import { useRoomStore, useToastStore } from '@/shared/model';

const GRACE_MS = OFFLINE_GRACE_SEC * 1000;
// 게임 화면에서 이 오류로 재입장이 거절되면 더 이상 이어서 할 수 없으므로 홈으로 보낸다
const SEAT_LOST_CODES = new Set(['ALREADY_LEFT', 'ROOM_NOT_FOUND']);
// 살아 있는 연결이면 재입장 응답이 이 안에 온다 — 넘으면 백그라운드 동안 끊긴 소켓으로 보고 다시 연결한다
const RESYNC_PROBE_MS = 4000;
// 다시 연결해도 응답이 없으면(서버 기동 지연·네트워크 불량) 스피너에 갇히지 않게 홈으로 보낸다
const RESYNC_TIMEOUT_MS = 15000;

/**
 * 앱이 백그라운드에 다녀오면 서버에 방 자리가 남아 있는지 확인하고, 확인하는 동안 방 화면 조작을 막는다(isResyncing).
 * - 게임 중: 백그라운드로 갈 때 방 소켓을 끊어 서버의 자리 유예(30초)를 시작한다.
 *   Android는 백그라운드에서도 JS가 돌아 연결이 유지되므로, 끊지 않으면 자리를 비운 채 게임에 남는다.
 *   30초 안에 돌아오면 다시 연결해 이어서 하고, 30초 이상이면 서버가 이미 퇴장 처리했으므로 바로 홈으로 간다.
 * - 대기실·시상식: 연결을 유지한 채 재입장으로 자리를 확인한다. iOS에서 끊긴 소켓은 응답이 없으므로 다시 연결한다.
 * - 자리가 없어졌으면(방 삭제·명단 제외) 대기실을 보여 주지 않고 바로 홈으로 간다.
 */
export function useRoomBackgroundGuard(code: string | undefined): void {
  const router = useRouter();
  const joinError = useRoomStore(s => s.joinError);
  const status = useRoomStore(s => s.roomState?.status);
  const isResyncing = useRoomStore(s => s.isResyncing);
  const backgroundAtRef = useRef<number | null>(null);
  const wasResyncingRef = useRef(false);

  useEffect(() => {
    if (!code) return;
    const subscription = AppState.addEventListener('change', next => {
      const { socket, roomCode, roomState, resync } = useRoomStore.getState();
      if (roomCode !== code || !socket) return;

      if (next === 'background') {
        backgroundAtRef.current = Date.now();
        if (roomState && isGameInProgressStatus(roomState.status)) socket.disconnect();
        return;
      }
      if (next !== 'active' || backgroundAtRef.current === null) return;

      const awayMs = Date.now() - backgroundAtRef.current;
      backgroundAtRef.current = null;
      if (roomState && isGameInProgressStatus(roomState.status) && awayMs >= GRACE_MS) {
        useToastStore.getState().show('장시간 참여하지 않아 홈으로 돌아왔어요!', 'info');
        router.replace('/(tabs)/' as never);
        return;
      }
      resync();
    });
    return () => subscription.remove();
  }, [code, router]);

  // 응답이 없으면 다시 연결하고, 그래도 없으면 홈으로 — 확인이 끝나면(room:state·거절) 타이머를 정리한다
  useEffect(() => {
    if (!isResyncing) return;
    const probe = setTimeout(() => {
      // 연결 중이면 socket.io가 계속 시도한다 — 연결됐다고 보는데 응답이 없을 때만 다시 연결한다
      if (useRoomStore.getState().socket?.connected) useRoomStore.getState().forceReconnect();
    }, RESYNC_PROBE_MS);
    const timeout = setTimeout(() => {
      useRoomStore.getState().endResync();
      useToastStore.getState().show('연결이 원활하지 않아 홈으로 돌아왔어요!', 'info');
      router.replace('/(tabs)/' as never);
    }, RESYNC_TIMEOUT_MS);
    return () => {
      clearTimeout(probe);
      clearTimeout(timeout);
    };
  }, [isResyncing, router]);

  // 복귀 확인 중 입장이 거절되면 어느 방 화면이든 바로 홈으로 (안내 토스트는 스토어가 띄운다)
  useEffect(() => {
    if (isResyncing) {
      wasResyncingRef.current = true;
      return;
    }
    if (!wasResyncingRef.current) return;
    wasResyncingRef.current = false;
    if (!joinError) return;
    // 대기실 화면과 게임 중 좌석 상실은 각자 홈으로 보낸다 — 시상식·리뷰 화면 등 나머지만 여기서 처리
    if (status === 'LOBBY' || (status && isGameInProgressStatus(status) && SEAT_LOST_CODES.has(joinError.code))) return;
    router.replace('/(tabs)/' as never);
  }, [isResyncing, joinError, status, router]);

  // 네트워크가 오래 끊겼다 재연결된 경우 등 — 게임 중 재입장이 거절되면 마지막 화면에 멈추지 않고 홈으로 (안내는 소켓 오류 토스트)
  useEffect(() => {
    if (!joinError || !SEAT_LOST_CODES.has(joinError.code)) return;
    if (!status || !isGameInProgressStatus(status)) return;
    router.replace('/(tabs)/' as never);
  }, [joinError, status, router]);
}
