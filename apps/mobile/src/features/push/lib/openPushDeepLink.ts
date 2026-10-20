import type { PushDeepLink } from '@sketch-catch/shared';
import { usePushStore } from '../model/usePushStore';

// 화면을 바로 열지 않고 대기 상태로 넘긴다 — NotificationGate가 스플래시·로그인·방 재동기화 이후
// 현재 방 상태(방 밖·대기실·게임)에 맞춰 입장 확인·나가기 확인·무시를 결정한다
export function openPushDeepLink(link: PushDeepLink): void {
  if (link.kind === 'invite') {
    usePushStore.getState().setPendingInvite(link.roomCode);
    return;
  }
  usePushStore.getState().setPendingFriendsNav(true);
}
