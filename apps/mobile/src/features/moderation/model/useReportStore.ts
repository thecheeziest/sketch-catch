import { create } from 'zustand';
import type { ModerationTarget } from './types';

type ReportStore = {
  // 신고 사유를 고르는 중인 대상 — 앱 루트의 ReportDialog 하나가 이 값을 보고 열린다
  target: ModerationTarget | null;
  // 프로필 모달 위에서 신고를 누른 경우 — 프로필이 완전히 닫힌 뒤(openQueued) 연다
  queued: ModerationTarget | null;
  open: (target: ModerationTarget) => void;
  queue: (target: ModerationTarget) => void;
  openQueued: () => void;
  close: () => void;
};

export const useReportStore = create<ReportStore>()(set => ({
  target: null,
  queued: null,
  open: target => set({ target }),
  queue: target => set({ queued: target }),
  openQueued: () => set(state => (state.queued ? { target: state.queued, queued: null } : state)),
  close: () => set({ target: null }),
}));
