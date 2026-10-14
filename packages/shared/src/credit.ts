import { z } from "zod";
import { noteSchema, phoneSchema } from "./fields";

/*
 * Credit (เงินเชื่อ) customers (plan.md → Business rules → Credit).
 * Balance = CHARGE − REPAYMENT − CHARGE_VOID. Names match ignoring case and spacing.
 */

export const CUSTOMER_NAME_MAX = 80;

export const customerNameSchema = z
  .string({ error: "Enter the customer's name" })
  .trim()
  .min(1, "Enter the customer's name")
  .max(CUSTOMER_NAME_MAX, "Name is too long")
  .transform((name) => name.replace(/\s+/g, " "));

/** "  Somchai  K " → "somchai k": stops "Somchai" and "somchai " becoming two customers. */
export function customerNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export interface CustomerSummary {
  id: string;
  name: string;
  phone: string | null;
  /** What they owe now, satang. Negative = the shop owes them (after a voided, part-paid bill). */
  balance: number;
}

export interface CustomerList {
  items: CustomerSummary[];
}

/** GET /credit/customers */
export const customerSearchSchema = z.object({
  search: z.string().trim().max(CUSTOMER_NAME_MAX).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});
export type CustomerSearch = z.input<typeof customerSearchSchema>;

// ---------- Customers (Credit page) ----------

/** "+ Add customer" and Edit (plan.md → Credit page). */
export const customerInputSchema = z.object({
  name: customerNameSchema,
  phone: phoneSchema,
  note: noteSchema,
});
export type CustomerInput = z.input<typeof customerInputSchema>;

export const REPAYMENT_METHODS = ["CASH", "PROMPTPAY"] as const;
export type RepaymentMethod = (typeof REPAYMENT_METHODS)[number];

/** POST /credit/repayments — can't be more than what they owe (checked by the API). */
export const repaymentInputSchema = z.object({
  customerId: z.uuid(),
  amount: z
    .number({ error: "Enter the amount paid" })
    .int("Amount must be whole satang")
    .min(1, "Enter the amount paid"),
  method: z.enum(REPAYMENT_METHODS, { error: "Pick how they paid" }),
  note: noteSchema,
});
export type RepaymentInput = z.input<typeof repaymentInputSchema>;

export type CreditEntryType = "CHARGE" | "REPAYMENT" | "CHARGE_VOID";

export interface CustomerOverview extends CustomerSummary {
  /** When the oldest bill that isn't fully paid was made (payments clear the oldest bills first). */
  oldestUnpaidAt: string | null;
}

export interface CreditStats {
  /** Sum of positive balances. */
  totalOwed: number;
  owingCount: number;
  /** Repayments made today (Bangkok), all methods. */
  collectedToday: number;
  collectedTodayCount: number;
}

/** GET /credit — every customer with balance and debt age, plus the stat cards. */
export interface CreditBoard {
  customers: CustomerOverview[];
  stats: CreditStats;
}

export interface CreditHistoryEntry {
  id: string;
  type: CreditEntryType;
  /** Signed for the balance: +280.00 for a credit sale, −300.00 for a payment or a voided bill. */
  amount: number;
  /** Repayments only. */
  method: RepaymentMethod | null;
  order: { id: string; billNo: string } | null;
  note: string | null;
  userName: string;
  createdAt: string;
  /** What they owed right after this entry. */
  balanceAfter: number;
}

/** GET /credit/customers/:id */
export interface CustomerDetail {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  balance: number;
  /** First credit bill, for "On credit since 8 Sep". */
  firstChargeAt: string | null;
  creditBillCount: number;
  oldestUnpaidAt: string | null;
  /** Newest first. */
  history: CreditHistoryEntry[];
}

export interface RepaymentResult {
  balanceBefore: number;
  balanceAfter: number;
}

interface LedgerEntry {
  type: CreditEntryType;
  amount: number;
  orderId: string | null;
  createdAt: string;
}

/**
 * When the oldest still-unpaid credit bill was made, or null if nothing is owed.
 * Payments clear the oldest bills first. A voided bill cancels what's left of its own charge;
 * anything already paid on it becomes credit for the other bills.
 */
export function oldestUnpaidAt(entries: readonly LedgerEntry[]): string | null {
  const charges: { orderId: string | null; left: number; createdAt: string }[] = [];
  let credit = 0; // money received that no bill has used yet

  const pay = (amount: number) => {
    let rest = amount;
    for (const charge of charges) {
      const used = Math.min(charge.left, rest);
      charge.left -= used;
      rest -= used;
      if (rest === 0) return;
    }
    credit += rest;
  };

  const sorted = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const entry of sorted) {
    if (entry.type === "CHARGE") {
      const used = Math.min(credit, entry.amount);
      credit -= used;
      charges.push({
        orderId: entry.orderId,
        left: entry.amount - used,
        createdAt: entry.createdAt,
      });
    } else if (entry.type === "REPAYMENT") {
      pay(entry.amount);
    } else {
      const own = charges.find((charge) => charge.orderId === entry.orderId);
      const cancelled = own ? Math.min(own.left, entry.amount) : 0;
      if (own) own.left -= cancelled;
      pay(entry.amount - cancelled);
    }
  }
  return charges.find((charge) => charge.left > 0)?.createdAt ?? null;
}
