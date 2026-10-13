import { z } from "zod";
import { customerNameSchema } from "./credit";
import { discountInputSchema, lineQtySchema, satangSchema } from "./pricing";

/*
 * Checkout and bills (plan.md → Checkout transaction, Payment dialog, Offline-ready rules).
 * The client sends only product ids and quantities; the API looks up prices and does the math.
 */

/** Most different products on one bill. */
export const MAX_BILL_LINES = 200;
/** Banknotes for the quick "amount received" chips. */
export const BANKNOTES_SATANG = [2000, 5000, 10000, 50000, 100000] as const;

export const PAYMENT_METHODS = ["CASH", "PROMPTPAY", "CREDIT"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const IDEMPOTENCY_HEADER = "idempotency-key";

/** One method per bill in Phase 1 (plan.md → Payments). */
export const paymentInputSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("CASH"),
    /** What the customer handed over; must cover the total. */
    cashReceived: satangSchema,
  }),
  /** Customer scans the printed shop QR; the bill is saved as PENDING until staff check the bank app. */
  z.object({ method: z.literal("PROMPTPAY") }),
  /** Added to what the customer owes: an existing customer, or a new one by name. */
  z.object({
    method: z.literal("CREDIT"),
    customer: z.union([z.object({ id: z.uuid() }), z.object({ newName: customerNameSchema })]),
  }),
]);
export type PaymentInput = z.input<typeof paymentInputSchema>;

/** POST /orders body (with an Idempotency-Key header). */
export const checkoutInputSchema = z.object({
  terminalId: z.uuid(),
  items: z
    .array(z.object({ productId: z.uuid(), qty: lineQtySchema }))
    .min(1, "The bill is empty")
    .max(MAX_BILL_LINES, `A bill can have at most ${MAX_BILL_LINES} different items`),
  discount: discountInputSchema.nullable(),
  payment: paymentInputSchema,
  /** The device's clock when the sale was made (needed for offline mode later). */
  clientCreatedAt: z.iso.datetime({ offset: true }),
});
export type CheckoutInput = z.input<typeof checkoutInputSchema>;

// ---------- Types returned by the API ----------

export interface OrderLine {
  productId: string;
  /** Name and price as they were at the sale (snapshots). */
  productName: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  billNo: string;
  status: "COMPLETED" | "VOIDED";
  terminalCode: string;
  cashierName: string;
  items: OrderLine[];
  subtotal: number;
  discountValue: number;
  discountAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  cashReceived: number | null;
  changeGiven: number | null;
  /** PromptPay bills only. */
  promptpay: {
    status: PromptpayStatus;
    receivedAt: string | null;
    receivedBy: string | null;
  } | null;
  /** Credit bills only. */
  customer: { id: string; name: string } | null;
  createdAt: string;
}

export type PromptpayStatus = "PENDING" | "RECEIVED";

/** POST /orders response. */
export interface CheckoutResponse {
  order: Order;
  /** Credit bills: what the customer owes after this bill (for the success screen). */
  customerBalance: number | null;
}

export interface Terminal {
  id: string;
  code: string;
  name: string;
}

export interface TerminalList {
  items: Terminal[];
}

// ---------- Helpers ----------

/** "T1", 125 → "T1-000125" (plan.md → bill numbers per terminal). */
export function formatBillNo(terminalCode: string, seq: number): string {
  return `${terminalCode}-${String(seq).padStart(6, "0")}`;
}

/**
 * Quick chips for "amount received": the exact total, then the next banknotes above it.
 * 30.00 → [30, 50, 100, 500]; 120.00 → [120, 500, 1,000]; 1,250.00 → [1,250].
 */
export function cashQuickAmounts(total: number, max = 4): number[] {
  // The first notes above the total are what customers actually hand over.
  const notes = BANKNOTES_SATANG.filter((note) => note > total);
  return [total, ...notes.slice(0, max - 1)];
}
