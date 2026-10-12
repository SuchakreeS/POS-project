import { create } from "zustand";

export interface Toast {
  id: number;
  tone: "success" | "error";
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastState {
  toast: Toast | null;
  show(toast: Omit<Toast, "id">): void;
  dismiss(id?: number): void;
}

let nextId = 1;

/** One toast at a time; a new one replaces the old one (plan.md → Toasts). */
export const useToastStore = create<ToastState>()((set, get) => ({
  toast: null,
  show: (toast) => set({ toast: { ...toast, id: nextId++ } }),
  dismiss: (id) => {
    if (id === undefined || get().toast?.id === id) set({ toast: null });
  },
}));

/** Call from anywhere (event handlers, mutation callbacks). */
export const toast = {
  success: (message: string, action?: Toast["action"]) =>
    useToastStore.getState().show({ tone: "success", message, action }),
  error: (message: string, action?: Toast["action"]) =>
    useToastStore.getState().show({ tone: "error", message, action }),
};
