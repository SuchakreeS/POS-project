import { create } from "zustand";

/*
 * One Bill detail dialog for the whole app. Any bill number (Orders table, movement history,
 * credit history, PromptPay page, sale done) opens it on top of whatever is on screen,
 * so staff never lose their place. <BillViewer /> is mounted once per layout.
 */

interface BillViewerState {
  orderId: string | null;
  open: (orderId: string) => void;
  close: () => void;
}

export const useBillViewer = create<BillViewerState>()((set) => ({
  orderId: null,
  open: (orderId) => set({ orderId }),
  close: () => set({ orderId: null }),
}));

export const openBill = (orderId: string) => useBillViewer.getState().open(orderId);
export const closeBill = () => useBillViewer.getState().close();
