import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { CLIENT_EVENT } from '@sketch-catch/shared';
import { useHardwareBack } from '@/shared/lib';
import { useAuthStore, useRoomStore, useToastStore } from '@/shared/model';

// 결과는 각 화면에서 보관하고, 서버가 대기실 복귀를 확인한 뒤에만 이동한다.
export function useAwardSession(code: string) {
  const router = useRouter();
  const socket = useRoomStore(s => s.socket);
  const userId = useAuthStore(s => s.user?.id);
  const [rematching, setRematching] = useState(false);
  const [rematchError, setRematchError] = useState<string | null>(null);
  // 시상식에 남은 방장에게 대기실 인원이 보낸 재촉 — 입장하기/나가기 모달로 묻는다
  const [isNudged, setIsNudged] = useState(false);
  const decidedRef = useRef(false);
  const pendingRef = useRef(false);

  const exit = useCallback((): void => {
    if (decidedRef.current) return;
    decidedRef.current = true;
    socket?.emit(CLIENT_EVENT.ROOM_LEAVE);
    router.replace('/(tabs)/' as never);
  }, [socket, router]);

  const rematch = useCallback((): void => {
    if (decidedRef.current || pendingRef.current) return;
    if (!socket?.connected) {
      useToastStore.getState().show('연결을 확인하고 다시 시도해 주세요!', 'error');
      return;
    }
    pendingRef.current = true;
    setRematching(true);
    socket.emit(CLIENT_EVENT.ROOM_REMATCH, { code });
  }, [socket, code]);

  // 뒤로가기로 시상식을 스킵하지 않는다. 퇴장은 명시적인 나가기 버튼으로만 한다.
  useHardwareBack(() => {});

  useEffect(() => {
    if (!userId) exit();
  }, [userId, exit]);

  useEffect(() => {
    const onState = (state: import('@sketch-catch/shared').RoomState): void => {
      if (!pendingRef.current || state.code !== code) return;
      const me = state.players.find(p => p.id === userId);
      if (state.status !== 'LOBBY' || !me || me.inAward) return;
      pendingRef.current = false;
      decidedRef.current = true;
      router.replace(`/room/${code}` as never);
    };
    const onError = ({ code: errorCode, message }: { code: string; message: string }): void => {
      if (errorCode === 'ROOM_NOT_FOUND' || errorCode === 'ALREADY_LEFT') {
        exit();
        return;
      }
      if (!pendingRef.current) return;
      pendingRef.current = false;
      setRematching(false);
      setRematchError(errorCode === 'GAME_IN_PROGRESS' ? '이미 게임이 시작됐어요!' : message);
    };
    const onDisconnect = (reason: string): void => {
      if (reason === 'io server disconnect') exit();
    };
    const onRemoved = (payload: { code: string }): void => {
      if (payload.code === code) exit();
    };
    const onNudged = (): void => {
      if (!decidedRef.current) setIsNudged(true);
    };
    socket?.on('room:state', onState);
    socket?.on('error', onError);
    socket?.on('room:removed', onRemoved);
    socket?.on('disconnect', onDisconnect);
    socket?.on('room:nudged', onNudged);
    return () => {
      socket?.off('room:state', onState);
      socket?.off('error', onError);
      socket?.off('room:removed', onRemoved);
      socket?.off('disconnect', onDisconnect);
      socket?.off('room:nudged', onNudged);
    };
  }, [socket, code, userId, router, exit]);

  useEffect(() => {
    if (!rematching) return;
    const timeout = setTimeout(() => {
      pendingRef.current = false;
      setRematching(false);
      useToastStore.getState().show('응답이 늦어요. 다시 시도해 주세요!', 'error');
    }, 8000);
    return () => clearTimeout(timeout);
  }, [rematching]);

  const dismissNudge = useCallback((): void => setIsNudged(false), []);

  return { rematch, exit, rematching, rematchError, isNudged, dismissNudge };
}
