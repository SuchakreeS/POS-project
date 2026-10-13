import type { Product, RestockInput } from "@pos/shared";

/*
 * The Restock dialog's list (plan.md → Restock modal), as pure functions so it can be tested.
 * Quantities are kept as typed text; a scan of an item already listed adds 1.
 */

export interface RestockRow {
  product: Product;
  qty: string;
}

export interface RestockList {
  rows: RestockRow[];
  /** Highlighted (last added or scanned). */
  lastId: string | null;
}

export const emptyRestockList: RestockList = { rows: [], lastId: null };

/** Whole number from 1 up, or null. */
export function parseQty(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const qty = Number(trimmed);
  return qty >= 1 ? qty : null;
}

/** Add an item with qty 1, or +1 if it's already listed. The newest row goes on top. */
export function addToList(list: RestockList, product: Product): RestockList {
  const existing = list.rows.find((row) => row.product.id === product.id);
  if (!existing) {
    return { rows: [{ product, qty: "1" }, ...list.rows], lastId: product.id };
  }
  const qty = String((parseQty(existing.qty) ?? 0) + 1);
  return {
    rows: list.rows.map((row) => (row === existing ? { product, qty } : row)),
    lastId: product.id,
  };
}

export function setQty(list: RestockList, productId: string, qty: string): RestockList {
  return {
    ...list,
    rows: list.rows.map((row) => (row.product.id === productId ? { ...row, qty } : row)),
  };
}

export function removeFromList(list: RestockList, productId: string): RestockList {
  return {
    rows: list.rows.filter((row) => row.product.id !== productId),
    lastId: list.lastId === productId ? null : list.lastId,
  };
}

export function summarize(list: RestockList) {
  const pieces = list.rows.reduce((sum, row) => sum + (parseQty(row.qty) ?? 0), 0);
  return {
    products: list.rows.length,
    pieces,
    valid: list.rows.length > 0 && list.rows.every((row) => parseQty(row.qty) !== null),
  };
}

export function toRestockInput(list: RestockList, note: string): RestockInput {
  return {
    items: list.rows.map((row) => ({ productId: row.product.id, qty: parseQty(row.qty) ?? 0 })),
    note,
  };
}
