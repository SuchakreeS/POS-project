import { MAX_LINE_QTY } from "@pos/shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/*
 * The current bill (plan.md → Checkout layout). Only product ids and quantities are kept:
 * names and prices come from the product list, and the API prices the bill at checkout.
 * Saved in local storage so a reload, a crash or a lost connection never loses the cart.
 */

export interface CartLine {
  productId: string;
  qty: number;
}

interface CartState {
  lines: CartLine[];
  /** Last scanned / clicked line: highlighted, and the one `Del` removes. */
  selectedId: string | null;
  /** Fixed discount typed by the cashier, satang. Null = no discount. */
  discount: number | null;

  /** +1 (or `by`) for a product; adds the line if new. */
  add(productId: string, by?: number): void;
  /** Set a quantity; below 1 removes the line. */
  setQty(productId: string, qty: number): void;
  remove(productId: string): void;
  select(productId: string | null): void;
  setDiscount(discount: number | null): void;
  clear(): void;
}

const clampQty = (qty: number) => Math.min(Math.max(Math.trunc(qty), 0), MAX_LINE_QTY);

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      selectedId: null,
      discount: null,

      add: (productId, by = 1) =>
        set((state) => {
          const existing = state.lines.find((line) => line.productId === productId);
          const lines = existing
            ? state.lines.map((line) =>
                line === existing ? { ...line, qty: clampQty(line.qty + by) } : line,
              )
            : [...state.lines, { productId, qty: clampQty(by) }];
          return { lines, selectedId: productId };
        }),

      setQty: (productId, qty) =>
        set((state) => {
          const next = clampQty(qty);
          if (next < 1) return removeLine(state, productId);
          return {
            lines: state.lines.map((line) =>
              line.productId === productId ? { ...line, qty: next } : line,
            ),
          };
        }),

      remove: (productId) => set((state) => removeLine(state, productId)),

      select: (selectedId) => set({ selectedId }),

      setDiscount: (discount) => set({ discount: discount && discount > 0 ? discount : null }),

      clear: () => set({ lines: [], selectedId: null, discount: null }),
    }),
    {
      name: "pos.cart.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ lines, selectedId, discount }) => ({ lines, selectedId, discount }),
    },
  ),
);

function removeLine(state: CartState, productId: string): Partial<CartState> {
  const lines = state.lines.filter((line) => line.productId !== productId);
  return {
    lines,
    selectedId:
      state.selectedId === productId ? (lines.at(-1)?.productId ?? null) : state.selectedId,
    discount: lines.length === 0 ? null : state.discount,
  };
}
