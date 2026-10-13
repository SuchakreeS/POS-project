import type { PromptPayBill, PromptPayBoard } from "@pos/shared";

export type PromptPayView = "pending" | "received" | "all";

/** The rows for a filter pill, oldest first (plan.md → PromptPay: default sort oldest first). */
export function billsFor(board: PromptPayBoard, view: PromptPayView): PromptPayBill[] {
  if (view === "pending") return board.pending;
  if (view === "received") return board.receivedToday;
  return [...board.pending, ...board.receivedToday].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

/** Selected ids that are still pending (a refresh may have removed some), with their total. */
export function selectionOf(board: PromptPayBoard, selected: ReadonlySet<string>) {
  const bills = board.pending.filter((bill) => selected.has(bill.orderId));
  return {
    ids: bills.map((bill) => bill.orderId),
    total: bills.reduce((sum, bill) => sum + bill.total, 0),
  };
}
