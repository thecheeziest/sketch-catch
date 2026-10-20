import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { parsePushDeepLink, PUSH_TYPE, type PushDeepLink } from '@sketch-catch/shared';
import { friendsQueryKeys } from '@/features/friends/api/queryKeys';
import { queryClient } from '@/shared/api';
import { useToastStore } from '@/shared/model';
import { openPushDeepLink } from './openPushDeepLink';

// 콜드 스타트 시 리스너와 getLastNotificationResponse가 같은 응답을 함께 넘길 수 있어 한 번만 처리한다
let lastHandledResponseId: string | null = null;

function parsePushType(data: unknown): string | null {
  const type = (data as { type?: unknown } | null)?.type;
  return typeof type === 'string' ? type : null;
}

// 친구 관련 푸시는 받은 즉시 목록을 다시 불러온다 — 푸시를 눌러 친구 화면에 와도 새 요청이 안 보이던 문제
function refreshForPush(data: unknown): void {
  const type = parsePushType(data);
  if (type === PUSH_TYPE.FRIEND_REQUEST || type === PUSH_TYPE.FRIEND_ACCEPT) {
    void queryClient.invalidateQueries({ queryKey: friendsQueryKeys.all });
  }
}

// data.url(딥링크)을 우선 해석하고, url이 없는 이전 서버의 푸시는 roomCode 유무로 판단한다
function resolvePushDeepLink(data: unknown): PushDeepLink {
  const { url, roomCode } = (data ?? {}) as { url?: unknown; roomCode?: unknown };
  const link = typeof url === 'string' ? parsePushDeepLink(url) : null;
  if (link) return link;
  if (typeof roomCode === 'string' && roomCode.length > 0) return { kind: 'invite', roomCode };
  return { kind: 'friends' };
}

function handleResponse(response: Notifications.NotificationResponse): void {
  const responseId = response.notification.request.identifier;
  if (responseId === lastHandledResponseId) return;
  lastHandledResponseId = responseId;
  // 처리한 응답을 지운다 — 남겨 두면 다음 실행 때마다 예전 초대 방으로 다시 이동해 '방을 찾지 못했어요'가 뜬다
  Notifications.clearLastNotificationResponse();

  const { data } = response.notification.request.content;
  refreshForPush(data);
  openPushDeepLink(resolvePushDeepLink(data));
}

// D-10 포그라운드 Toast + Pattern 3 탭 딥링크(웜/콜드 스타트) 등록
export function useNotificationListeners(): void {
  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(notification => {
      const { title, body, data } = notification.request.content;
      refreshForPush(data);
      useToastStore.getState().show(`${title ?? ''} ${body ?? ''}`.trim());
    });
    const responseSub = Notifications.addNotificationResponseReceivedListener(handleResponse);

    // Pitfall 3: 콜드 스타트로 앱이 실행된 경우 addNotificationResponseReceivedListener는 발동하지 않음
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) handleResponse(lastResponse);

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);
}
