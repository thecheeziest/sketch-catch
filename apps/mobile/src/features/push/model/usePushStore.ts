import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

type PushStore = {
  pendingInviteRoomCode: string | null;
  setPendingInvite: (code: string | null) => void;
};

// D-11: 게임 초대 푸시 클릭 시 이미 다른 방에 속해 있으면 room-switch 확인 Dialog(NotificationGate)가 이 값을 읽는다
export const usePushStore = create<PushStore>()(
  immer((set) => ({
    pendingInviteRoomCode: null,
    setPendingInvite: (code) =>
      set((s) => {
        s.pendingInviteRoomCode = code;
      }),
  }))
);
