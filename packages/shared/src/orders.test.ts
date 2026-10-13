import { describe, expect, it } from "vitest";
import { cashQuickAmounts, checkoutInputSchema, formatBillNo } from "./orders";

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
