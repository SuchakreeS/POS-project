import { z } from "zod";
import { MAX_SATANG } from "./money";

/*
 * Bill math (plan.md → Business rules → Discount, Checkout).
 * The API calls these to compute the saved bill; the web app calls the same functions
 * to show the cart, so the screen and the receipt can never disagree.
 */

/** Most units of one product on a single bill line. */
export const MAX_LINE_QTY = 9_999;

export const satangSchema = z
  .number({ error: "Enter an amount" })
  .int("Amount must be whole satang")
  .min(0, "Amount can't be negative")
  .max(MAX_SATANG, "Amount is too large");

export const lineQtySchema = z
  .number({ error: "Enter a quantity" })
  .int("Quantity must be a whole number")
  .min(1, "Quantity must be at least 1")
  .max(MAX_LINE_QTY, `Quantity can't be more than ${MAX_LINE_QTY.toLocaleString("en-US")}`);

/**
 * Phase 1: a fixed THB amount typed by the cashier.
 * PERCENT is reserved in the database; add it here (as a discriminated union) when its rounding rule is decided.
 */
export const discountInputSchema = z.object({
  type: z.literal("FIXED"),
  value: satangSchema,
});
export type DiscountInput = z.infer<typeof discountInputSchema>;

export interface PricedLine {
  unitPrice: number; // satang
  qty: number;
}

export interface BillTotals {
  subtotal: number;
  /** What the cashier typed (stored as Order.discountValue). */
  discountValue: number;
  /** What was actually taken off: never more than the subtotal (Order.discountAmount). */
  discountAmount: number;
  /** subtotal − discountAmount, never below 0. */
  total: number;
}

export function lineTotal({ unitPrice, qty }: PricedLine): number {
  return unitPrice * qty;
}

/** Discount actually applied: the typed value, capped so the total can't go below 0. */
export function appliedDiscount(
  subtotal: number,
  discount: DiscountInput | null | undefined,
): number {
  if (!discount) return 0;
  return Math.min(Math.max(discount.value, 0), subtotal);
}

export function calculateBill(
  lines: readonly PricedLine[],
  discount?: DiscountInput | null,
): BillTotals {
  const subtotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const discountAmount = appliedDiscount(subtotal, discount);
  return {
    subtotal,
    discountValue: discount?.value ?? 0,
    discountAmount,
    total: subtotal - discountAmount,
  };
}

export interface CashResult {
  /** Change to give back; 0 while the money received is short. */
  change: number;
  /** How much is still missing; 0 when enough was received. */
  short: number;
}

/** Cash payment: change to give, or how much is still missing ("Short by 5.00 ฿"). */
export function calculateCash(total: number, received: number): CashResult {
  return received >= total
    ? { change: received - total, short: 0 }
    : { change: 0, short: total - received };
}
