import { calculateBill, type BillTotals, type Product } from "@pos/shared";
import type { CartLine } from "./cart-store";

/*
 * Turns the stored cart (ids + quantities) into what the screen shows, using the same
 * calculateBill as the API so the total on screen is the total on the bill.
 */

export interface CartRow {
  productId: string;
  qty: number;
  /** Undefined when the item is gone from the product list. */
  product: Product | undefined;
  lineTotal: number;
  /** Why this line can't be sold right now (removed or turned off). */
  problem: string | null;
}

export interface CartView {
  rows: CartRow[];
  totals: BillTotals;
  /** Units, not lines: 2 × water + 1 chips = 3. */
  itemCount: number;
  /** True when every line can be sold. */
  sellable: boolean;
}

export function buildCart(
  lines: readonly CartLine[],
  products: readonly Product[],
  discount: number | null,
): CartView {
  const byId = new Map(products.map((product) => [product.id, product]));
  const rows = lines.map((line): CartRow => {
    const product = byId.get(line.productId);
    const problem = !product ? "No longer in the system" : !product.isActive ? "Turned off" : null;
    return {
      productId: line.productId,
      qty: line.qty,
      product,
      lineTotal: (product?.price ?? 0) * line.qty,
      problem,
    };
  });

  const priced = rows.filter((row) => row.product && !row.problem);
  const totals = calculateBill(
    priced.map((row) => ({ unitPrice: row.product?.price ?? 0, qty: row.qty })),
    discount ? { type: "FIXED", value: discount } : null,
  );

  return {
    rows,
    totals,
    itemCount: rows.reduce((sum, row) => sum + row.qty, 0),
    sellable: rows.length > 0 && rows.every((row) => !row.problem),
  };
}

/**
 * Misclick guard (stock): adding more than the stock count asks first — once per product per bill.
 * Never blocks: stock can be wrong (a delivery not entered yet), and the item is in the customer's hand.
 */
export function needsStockConfirm(
  product: Pick<Product, "id" | "stockQty">,
  nextQty: number,
  confirmed: readonly string[],
): boolean {
  return nextQty > product.stockQty && !confirmed.includes(product.id);
}
