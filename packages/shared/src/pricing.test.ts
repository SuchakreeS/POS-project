import { describe, expect, it } from "vitest";
import { MAX_SATANG } from "./money";
import {
  calculateBill,
  calculateCash,
  discountInputSchema,
  lineQtySchema,
  satangSchema,
} from "./pricing";

const fixed = (value: number) => ({ type: "FIXED" as const, value });

describe("calculateBill", () => {
  const lines = [
    { unitPrice: 2500, qty: 2 }, // 50.00
    { unitPrice: 1000, qty: 5 }, // 50.00
  ];

  it("adds up the lines", () => {
    expect(calculateBill(lines)).toEqual({
      subtotal: 10000,
      discountValue: 0,
      discountAmount: 0,
      total: 10000,
    });
  });

  it("applies a fixed discount (plan example: 100 THB − 10 THB = 90 THB)", () => {
    expect(calculateBill(lines, fixed(1000))).toEqual({
      subtotal: 10000,
      discountValue: 1000,
      discountAmount: 1000,
      total: 9000,
    });
  });

  it("caps the discount at the subtotal, so the total is never below 0 (plan example: 50 THB, discount 80 THB)", () => {
    expect(calculateBill([{ unitPrice: 5000, qty: 1 }], fixed(8000))).toEqual({
      subtotal: 5000,
      discountValue: 8000, // what was typed is kept
      discountAmount: 5000, // what was applied
      total: 0,
    });
  });

  it("handles an empty cart and a null discount", () => {
    expect(calculateBill([], null)).toEqual({
      subtotal: 0,
      discountValue: 0,
      discountAmount: 0,
      total: 0,
    });
    expect(calculateBill([], fixed(500)).total).toBe(0);
  });

  it("never applies a negative discount", () => {
    expect(calculateBill(lines, fixed(-500)).total).toBe(10000);
  });
});

describe("calculateCash", () => {
  it("gives change when enough is received", () => {
    expect(calculateCash(3000, 10000)).toEqual({ change: 7000, short: 0 });
    expect(calculateCash(3000, 3000)).toEqual({ change: 0, short: 0 });
  });

  it("reports how much is missing", () => {
    expect(calculateCash(3000, 2500)).toEqual({ change: 0, short: 500 });
  });
});

describe("schemas", () => {
  it("accepts whole satang only", () => {
    expect(satangSchema.safeParse(1250).success).toBe(true);
    expect(satangSchema.safeParse(12.5).success).toBe(false);
    expect(satangSchema.safeParse(-1).success).toBe(false);
    expect(satangSchema.safeParse(MAX_SATANG + 1).success).toBe(false);
    expect(satangSchema.safeParse("1250").success).toBe(false);
  });

  it("accepts quantities from 1 to 9,999", () => {
    expect(lineQtySchema.safeParse(1).success).toBe(true);
    expect(lineQtySchema.safeParse(9999).success).toBe(true);
    expect(lineQtySchema.safeParse(0).success).toBe(false);
    expect(lineQtySchema.safeParse(10000).success).toBe(false);
    expect(lineQtySchema.safeParse(1.5).success).toBe(false);
  });

  it("only allows fixed discounts in Phase 1", () => {
    expect(discountInputSchema.safeParse({ type: "FIXED", value: 1000 }).success).toBe(true);
    expect(discountInputSchema.safeParse({ type: "PERCENT", value: 1000 }).success).toBe(false);
  });

  it("uses friendly messages", () => {
    const result = satangSchema.safeParse(undefined);
    expect(result.error?.issues[0]?.message).toBe("Enter an amount");
  });
});
