import type { CustomerSummary } from "@pos/shared";

/** Who a credit sale is for: someone already in the book, or a new name. */
export type CustomerChoice =
  { kind: "existing"; customer: CustomerSummary } | { kind: "new"; name: string };

/** Balance before this sale: existing customers' current balance, 0 for a new one. */
export function balanceOf(choice: CustomerChoice): number {
  return choice.kind === "existing" ? choice.customer.balance : 0;
}

export function nameOf(choice: CustomerChoice): string {
  return choice.kind === "existing" ? choice.customer.name : choice.name;
}
