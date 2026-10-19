import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type ToastKind = 'info' | 'success' | 'error';
// 사용자가 꼭 알아야 하는 알림은 상단에 띄운다
export type ToastPosition = 'top' | 'bottom';
type Toast = { id: string; message: string; kind: ToastKind; position: ToastPosition };

type ToastState = {
  toasts: Toast[];
};

type ToastActions = {
  show: (message: string, kind?: ToastKind, position?: ToastPosition) => void;
  dismiss: (id: string) => void;
};

export const useToastStore = create<ToastState & ToastActions>()(
  immer((set) => ({
    toasts: [],
    show: (message, kind = 'info', position = 'bottom') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      set((s) => {
        s.toasts.push({ id, message, kind, position });
      });
      setTimeout(() => {
        set((s) => {
          s.toasts = s.toasts.filter((t) => t.id !== id);
        });
      }, 2500);
    },
    dismiss: (id) =>
      set((s) => {
        s.toasts = s.toasts.filter((t) => t.id !== id);
      }),
  }))
);
