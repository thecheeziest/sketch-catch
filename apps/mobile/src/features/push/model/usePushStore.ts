import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

type PushStore = {
  pendingInviteRoomCode: string | null;
  setPendingInvite: (code: string | null) => void;
};

// 게임 초대 푸시를 누르면 저장 — NotificationGate가 읽어 입장 확인 또는 D-11 방 이동 확인 Dialog를 띄운다
export const usePushStore = create<PushStore>()(
  immer((set) => ({
    pendingInviteRoomCode: null,
    setPendingInvite: (code) =>
      set((s) => {
        s.pendingInviteRoomCode = code;
      }),
  }))
);
