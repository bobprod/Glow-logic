import { StateCreator } from "zustand";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  detail?: string;
  duration?: number; // ms, default 3000
}

export interface ToastSlice {
  toasts: Toast[];
  addToast: (t: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

export const createToastSlice: StateCreator<ToastSlice, [], [], ToastSlice> = (
  set,
) => ({
  toasts: [],
  addToast: (t) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, t.duration ?? 3000);
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
});
