import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

type PushStore = {
  pendingInviteRoomCode: string | null;
  // 친구 요청·수락 푸시를 눌러 친구 화면으로 가야 하는 상태 — 대기실·게임 중이면 NotificationGate가 가드한다
  pendingFriendsNav: boolean;
  setPendingInvite: (code: string | null) => void;
  setPendingFriendsNav: (pending: boolean) => void;
};

// 푸시를 누르면(초대는 인앱 수신 포함) 저장 — NotificationGate가 현재 방 상태에 맞춰 확인·이동을 처리한다
export const usePushStore = create<PushStore>()(
  immer(set => ({
    pendingInviteRoomCode: null,
    pendingFriendsNav: false,
    setPendingInvite: code =>
      set(s => {
        s.pendingInviteRoomCode = code;
      }),
    setPendingFriendsNav: pending =>
      set(s => {
        s.pendingFriendsNav = pending;
      }),
  })),
);
