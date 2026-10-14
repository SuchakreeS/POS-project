import type { Order } from "@pos/shared";
import { describe, expect, it } from "vitest";
import { piecesLabel, voidEffect } from "./orders-view";

const line = (qty: number) => ({
  productId: `p${qty}`,
  productName: "Item",
  unitPrice: 1000,
  qty,
  lineTotal: qty * 1000,
});

const order = (patch: Partial<Order>): Order => ({
  id: "o1",
  billNo: "T1-000124",
  status: "COMPLETED",
  terminalCode: "T1",
  cashierName: "Nok",
  items: [line(30), line(4), line(2), line(1)],
  subtotal: 37000,
  discountValue: 0,
  discountAmount: 0,
  total: 37000,
  paymentMethod: "CASH",
  cashReceived: 40000,
  changeGiven: 3000,
  promptpay: null,
  customer: null,
  voided: null,
  createdAt: "2026-10-14T07:32:00Z",
  ...patch,
});

describe("piecesLabel", () => {
  it("counts pieces and items, singular when one", () => {
    expect(piecesLabel(37, 4)).toBe("37 pcs (4 items)");
    expect(piecesLabel(1, 1)).toBe("1 pc (1 item)");
  });
});

describe("voidEffect", () => {
  const tail = " The bill stays in the list as Voided.";

  it("cancels a pending PromptPay payment", () => {
    const bill = order({
      paymentMethod: "PROMPTPAY",
      promptpay: { status: "PENDING", receivedAt: null, receivedBy: null },
    });
    expect(voidEffect(bill)).toBe(
      `Voiding returns 37 pcs (4 items) to stock and cancels the pending PromptPay payment.${tail}`,
    );
  });

  it("says to send back a PromptPay payment that was already received", () => {
    const bill = order({
      paymentMethod: "PROMPTPAY",
      promptpay: { status: "RECEIVED", receivedAt: "2026-10-14T08:00:00Z", receivedBy: "Nok" },
    });
    expect(voidEffect(bill)).toContain("already received: send 370.00 ฿ back to the customer.");
  });

  it("takes the amount off a credit customer's balance", () => {
    const bill = order({ paymentMethod: "CREDIT", customer: { id: "c1", name: "Somchai" } });
    expect(voidEffect(bill)).toContain("and takes 370.00 ฿ off what Somchai owes.");
  });

  it("gives cash back, unless the bill was free", () => {
    expect(voidEffect(order({}))).toContain(". Give the customer back 370.00 ฿ in cash.");
    expect(voidEffect(order({ items: [line(1)], total: 0 }))).toBe(
      `Voiding returns 1 pc (1 item) to stock.${tail}`,
    );
  });
});
