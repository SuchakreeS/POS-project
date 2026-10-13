import { z } from "zod";
import type { PromptpayStatus } from "./orders";

/*
 * PromptPay check page (plan.md → PromptPay). The shop's printed QR carries no bill reference,
 * so staff match bills to the bank app by amount and time, then mark them received.
 */

export interface PromptPayBill {
  orderId: string;
  billNo: string;
  total: number;
  cashierName: string;
  createdAt: string;
  status: PromptpayStatus;
  receivedAt: string | null;
  receivedBy: string | null;
}

export interface PromptPayStats {
  pendingCount: number;
  pendingTotal: number;
  receivedTodayCount: number;
  receivedTodayTotal: number;
}

/** GET /promptpay — every pending bill (any date) and today's received ones, oldest first. */
export interface PromptPayBoard {
  pending: PromptPayBill[];
  receivedToday: PromptPayBill[];
  stats: PromptPayStats;
}

/** GET /promptpay/summary — for the sidebar badge. */
export interface PromptPaySummary {
  pendingCount: number;
}

export const MAX_RECEIVE_AT_ONCE = 200;

/** POST /promptpay/receive */
export const promptpayReceiveSchema = z.object({
  orderIds: z.array(z.uuid()).min(1, "Pick at least one bill").max(MAX_RECEIVE_AT_ONCE),
});
export type PromptPayReceiveInput = z.input<typeof promptpayReceiveSchema>;

/** POST /promptpay/:orderId/undo */
export const promptpayUndoSchema = z.object({
  reason: z
    .string({ error: "Say why it wasn't received" })
    .trim()
    .min(1, "Say why it wasn't received")
    .max(200, "Reason is too long"),
});
export type PromptPayUndoInput = z.input<typeof promptpayUndoSchema>;

/** Two pending bills with the same amount this close together need careful matching. */
export const SAME_AMOUNT_WINDOW_MS = 30 * 60 * 1000;

/** Ids of pending bills that share their amount with another pending bill within 30 minutes. */
export function sameAmountIds(
  bills: readonly Pick<PromptPayBill, "orderId" | "total" | "createdAt">[],
): Set<string> {
  const flagged = new Set<string>();
  const byAmount = new Map<number, { orderId: string; time: number }[]>();
  for (const bill of bills) {
    const list = byAmount.get(bill.total) ?? [];
    list.push({ orderId: bill.orderId, time: new Date(bill.createdAt).getTime() });
    byAmount.set(bill.total, list);
  }
  for (const list of byAmount.values()) {
    list.sort((a, b) => a.time - b.time);
    for (let i = 1; i < list.length; i++) {
      const [prev, curr] = [list[i - 1], list[i]];
      if (prev && curr && curr.time - prev.time <= SAME_AMOUNT_WINDOW_MS) {
        flagged.add(prev.orderId);
        flagged.add(curr.orderId);
      }
    }
  }
  return flagged;
}
