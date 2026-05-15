import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

type Toast = { id: string; message: string };

type ToastState = {
  toasts: Toast[];
};

type ToastActions = {
  show: (message: string) => void;
  dismiss: (id: string) => void;
};

export const useToastStore = create<ToastState & ToastActions>()(
  immer((set) => ({
    toasts: [],
    show: (message) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      set((s) => {
        s.toasts.push({ id, message });
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
