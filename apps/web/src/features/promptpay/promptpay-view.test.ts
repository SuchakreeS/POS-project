import type { PromptPayBill, PromptPayBoard } from "@pos/shared";
import { describe, expect, it } from "vitest";
import { billsFor, selectionOf } from "./promptpay-view";

const bill = (
  orderId: string,
  total: number,
  createdAt: string,
  received = false,
): PromptPayBill => ({
  orderId,
  billNo: orderId,
  total,
  cashierName: "Nok",
  createdAt,
  status: received ? "RECEIVED" : "PENDING",
  receivedAt: received ? createdAt : null,
  receivedBy: received ? "Nok" : null,
});

const board: PromptPayBoard = {
  pending: [bill("a", 4500, "2026-10-12T07:00:00Z"), bill("c", 2000, "2026-10-13T08:00:00Z")],
  receivedToday: [bill("b", 1000, "2026-10-13T07:30:00Z", true)],
  stats: { pendingCount: 2, pendingTotal: 6500, receivedTodayCount: 1, receivedTodayTotal: 1000 },
};

describe("billsFor", () => {
  it("shows pending, received or both oldest first", () => {
    expect(billsFor(board, "pending").map((b) => b.orderId)).toEqual(["a", "c"]);
    expect(billsFor(board, "received").map((b) => b.orderId)).toEqual(["b"]);
    expect(billsFor(board, "all").map((b) => b.orderId)).toEqual(["a", "b", "c"]);
  });
});

describe("selectionOf", () => {
  it("keeps only pending bills and adds them up", () => {
    expect(selectionOf(board, new Set(["a", "b", "gone"]))).toEqual({ ids: ["a"], total: 4500 });
  });
});
