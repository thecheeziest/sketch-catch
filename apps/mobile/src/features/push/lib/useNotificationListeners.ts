import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { CLIENT_EVENT } from '@sketch-catch/shared';
import { useToastStore, useRoomStore } from '@/shared/model';
import { usePushStore } from '../model/usePushStore';

function parseRoomCode(data: unknown): string | null {
  const roomCode = (data as { roomCode?: unknown } | null)?.roomCode;
  return typeof roomCode === 'string' && roomCode.length > 0 ? roomCode : null;
}

function handleGameInviteTap(roomCode: string): void {
  const roomState = useRoomStore.getState().roomState;
  if (roomState) {
    // 이미 다른 방에 속해 있음 — D-11 NotificationGate Dialog가 확인 후 leave+join 처리
    usePushStore.getState().setPendingInvite(roomCode);
    return;
  }
  useRoomStore.getState().socket?.emit(CLIENT_EVENT.ROOM_JOIN, { code: roomCode });
  router.push(`/room/${roomCode}` as never);
}

function handleResponse(response: Notifications.NotificationResponse): void {
  const roomCode = parseRoomCode(response.notification.request.content.data);
  if (!roomCode) {
    router.push('/(tabs)/friends' as never);
    return;
  }
  handleGameInviteTap(roomCode);
}

// D-10 포그라운드 Toast + Pattern 3 탭 딥링크(웜/콜드 스타트) 등록
export function useNotificationListeners(): void {
  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      useToastStore.getState().show(`${title ?? ''} ${body ?? ''}`.trim());
    });
    const responseSub = Notifications.addNotificationResponseReceivedListener(handleResponse);

    // Pitfall 3: 콜드 스타트로 앱이 실행된 경우 addNotificationResponseReceivedListener는 발동하지 않음
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response);
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);
}
