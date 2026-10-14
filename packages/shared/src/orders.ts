import { z } from "zod";
import { customerNameSchema } from "./credit";
import { noteSchema } from "./fields";
import { discountInputSchema, lineQtySchema, satangSchema } from "./pricing";
import { addDays, bangkokDateKey, dateKeySchema, isDateKey } from "./time";

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

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  PROMPTPAY: "PromptPay",
  CREDIT: "Credit",
};

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
  /** Voided bills only: who, when and why. */
  voided: { at: string; by: string; reason: string; note: string | null } | null;
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
  /** The bill number its next sale gets, e.g. "T1-000126". */
  nextBillNo: string;
}

export interface TerminalList {
  items: Terminal[];
}

// ---------- Orders page ----------

/** Reason chips in the void step (plan.md → Bill detail dialog). "Other" needs a note. */
export const VOID_REASONS = [
  "Wrong items",
  "Customer changed mind",
  "Payment not received",
  "Duplicate bill",
  "Other",
] as const;
export type VoidReason = (typeof VOID_REASONS)[number];

/** POST /orders/:id/void */
export const voidInputSchema = z
  .object({
    reason: z.enum(VOID_REASONS, { error: "Pick a reason" }),
    note: noteSchema,
  })
  .superRefine((input, ctx) => {
    if (input.reason === "Other" && !input.note) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "Say what happened" });
    }
  });
export type VoidInput = z.input<typeof voidInputSchema>;

/** Filter chips: All / Cash / PromptPay / Credit, and Voided on its own. */
export const ORDER_FILTERS = ["ALL", ...PAYMENT_METHODS, "VOIDED"] as const;
export type OrderFilter = (typeof ORDER_FILTERS)[number];

/** Longest date range the Orders page asks for at once. */
export const MAX_ORDER_RANGE_DAYS = 366;

/** GET /orders — bills between two Bangkok days (inclusive), newest first. */
export const orderListQuerySchema = z
  .object({
    from: dateKeySchema.default(() => bangkokDateKey()),
    to: dateKeySchema.default(() => bangkokDateKey()),
    /** Bill number or credit customer name. */
    search: z.string().trim().max(80).default(""),
    filter: z.enum(ORDER_FILTERS).default("ALL"),
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((query) => query.from <= query.to, {
    path: ["to"],
    message: "The end date is before the start date",
  })
  // Zod still runs object checks after a bad field, so only measure real days.
  .refine(
    (query) => !isDateKey(query.from) || query.to <= addDays(query.from, MAX_ORDER_RANGE_DAYS - 1),
    {
      path: ["to"],
      message: `Pick at most ${MAX_ORDER_RANGE_DAYS} days`,
    },
  );
export type OrderListQuery = z.input<typeof orderListQuerySchema>;

/** One row of the Orders table. */
export interface OrderSummary {
  id: string;
  billNo: string;
  status: Order["status"];
  paymentMethod: PaymentMethod;
  promptpayStatus: PromptpayStatus | null;
  customerName: string | null;
  /** Different items (lines) and pieces (sum of qty). */
  lineCount: number;
  pieceCount: number;
  total: number;
  createdAt: string;
}

/** Totals for one payment method over the date range and search. Voided bills are counted apart. */
export interface OrderMethodStats {
  bills: number;
  sales: number;
  voided: number;
  voidedTotal: number;
  promptpayPending: number;
}
export type OrderStats = Record<PaymentMethod, OrderMethodStats>;

export interface OrderPage {
  items: OrderSummary[];
  /** Pass back as `cursor` to load older bills; null when there are none. */
  nextCursor: string | null;
  /** Ignores the filter chip (so every chip can show its count), follows dates and search. */
  stats: OrderStats;
}

export const emptyMethodStats = (): OrderMethodStats => ({
  bills: 0,
  sales: 0,
  voided: 0,
  voidedTotal: 0,
  promptpayPending: 0,
});

/** The summary strip for a chip: one method, or every method added up. */
export function statsFor(stats: OrderStats, filter: OrderFilter): OrderMethodStats {
  const methods = PAYMENT_METHODS.filter(
    (method) => filter === "ALL" || filter === "VOIDED" || filter === method,
  );
  return methods.reduce((sum, method) => {
    const row = stats[method];
    return {
      bills: sum.bills + row.bills,
      sales: sum.sales + row.sales,
      voided: sum.voided + row.voided,
      voidedTotal: sum.voidedTotal + row.voidedTotal,
      promptpayPending: sum.promptpayPending + row.promptpayPending,
    };
  }, emptyMethodStats());
}

/** How many rows each chip shows (voided bills stay listed under All and their method). */
export function orderFilterCounts(stats: OrderStats): Record<OrderFilter, number> {
  const all = statsFor(stats, "ALL");
  const listed = (row: OrderMethodStats) => row.bills + row.voided;
  return {
    ALL: listed(all),
    CASH: listed(stats.CASH),
    PROMPTPAY: listed(stats.PROMPTPAY),
    CREDIT: listed(stats.CREDIT),
    VOIDED: all.voided,
  };
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
