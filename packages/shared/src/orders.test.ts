import { describe, expect, it } from "vitest";
import {
  cashQuickAmounts,
  checkoutInputSchema,
  formatBillNo,
  orderFilterCounts,
  orderListQuerySchema,
  statsFor,
  voidInputSchema,
  type OrderStats,
} from "./orders";
import { bangkokDateKey } from "./time";

describe("formatBillNo", () => {
  it("pads the sequence to 6 digits", () => {
    expect(formatBillNo("T1", 125)).toBe("T1-000125");
    expect(formatBillNo("T2", 1234567)).toBe("T2-1234567");
  });
});

describe("cashQuickAmounts", () => {
  it("offers the exact amount then the next banknotes", () => {
    expect(cashQuickAmounts(3000)).toEqual([3000, 5000, 10000, 50000]);
    expect(cashQuickAmounts(12000)).toEqual([12000, 50000, 100000]);
    expect(cashQuickAmounts(5000)).toEqual([5000, 10000, 50000, 100000]);
    expect(cashQuickAmounts(125000)).toEqual([125000]);
  });
});

describe("checkoutInputSchema", () => {
  const ID = "3f1c2b9a-7d4e-4c1a-9b8e-2a6f0d5c1e77";
  const input = {
    terminalId: ID,
    items: [{ productId: ID, qty: 2 }],
    discount: null,
    payment: { method: "CASH", cashReceived: 10000 },
    clientCreatedAt: "2026-10-13T14:05:00.000+07:00",
  };

  it("accepts a cash sale", () => {
    expect(checkoutInputSchema.safeParse(input).success).toBe(true);
  });

  it("rejects an empty bill, a bad quantity and unknown methods", () => {
    expect(checkoutInputSchema.safeParse({ ...input, items: [] }).error?.issues[0]?.message).toBe(
      "The bill is empty",
    );
    expect(
      checkoutInputSchema.safeParse({ ...input, items: [{ productId: ID, qty: 0 }] }).success,
    ).toBe(false);
    expect(
      checkoutInputSchema.safeParse({ ...input, payment: { method: "BITCOIN" } }).success,
    ).toBe(false);
  });
});

describe("voidInputSchema", () => {
  it("needs a reason from the list", () => {
    expect(voidInputSchema.safeParse({ reason: "Wrong items" }).data).toEqual({
      reason: "Wrong items",
      note: null,
    });
    expect(voidInputSchema.safeParse({ reason: "Because" }).success).toBe(false);
    expect(voidInputSchema.safeParse({}).success).toBe(false);
  });

  it('needs a note for "Other" (blank counts as none)', () => {
    const missing = voidInputSchema.safeParse({ reason: "Other", note: "   " });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(["note"]);
    expect(voidInputSchema.safeParse({ reason: "Other", note: "Rang twice" }).success).toBe(true);
  });
});

describe("orderListQuerySchema", () => {
  it("defaults to today, all bills, 50 at a time", () => {
    const today = bangkokDateKey();
    expect(orderListQuerySchema.parse({})).toEqual({
      from: today,
      to: today,
      search: "",
      filter: "ALL",
      limit: 50,
    });
  });

  it("rejects bad dates, a backwards range and a range over a year", () => {
    expect(orderListQuerySchema.safeParse({ from: "2026-02-30" }).success).toBe(false);
    expect(orderListQuerySchema.safeParse({ from: "2026-10-02", to: "2026-10-01" }).success).toBe(
      false,
    );
    expect(
      orderListQuerySchema.safeParse({ from: "2025-10-01", to: "2026-10-01" }).success, // 366 days
    ).toBe(true);
    expect(orderListQuerySchema.safeParse({ from: "2025-10-01", to: "2026-10-02" }).success).toBe(
      false,
    );
  });
});

describe("statsFor / orderFilterCounts", () => {
  const stats: OrderStats = {
    CASH: { bills: 3, sales: 30000, voided: 1, voidedTotal: 5000, promptpayPending: 0 },
    PROMPTPAY: { bills: 2, sales: 12000, voided: 0, voidedTotal: 0, promptpayPending: 1 },
    CREDIT: { bills: 1, sales: 7000, voided: 1, voidedTotal: 2000, promptpayPending: 0 },
  };

  it("adds every method up for All and Voided, or picks one", () => {
    expect(statsFor(stats, "ALL")).toEqual({
      bills: 6,
      sales: 49000,
      voided: 2,
      voidedTotal: 7000,
      promptpayPending: 1,
    });
    expect(statsFor(stats, "VOIDED")).toEqual(statsFor(stats, "ALL"));
    expect(statsFor(stats, "PROMPTPAY")).toEqual(stats.PROMPTPAY);
  });

  it("counts voided bills under All and their method, and on their own", () => {
    expect(orderFilterCounts(stats)).toEqual({
      ALL: 8,
      CASH: 4,
      PROMPTPAY: 2,
      CREDIT: 2,
      VOIDED: 2,
    });
  });
});
