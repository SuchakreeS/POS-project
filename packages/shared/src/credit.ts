import { z } from "zod";

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
