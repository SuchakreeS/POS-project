import { describe, expect, it } from "vitest";
import { customerInputSchema, oldestUnpaidAt, repaymentInputSchema } from "./credit";

const at = (day: number) => `2026-10-${String(day).padStart(2, "0")}T05:00:00.000Z`;
const charge = (day: number, amount: number, orderId = `o${day}`) =>
  ({ type: "CHARGE", amount, orderId, createdAt: at(day) }) as const;
const repay = (day: number, amount: number) =>
  ({ type: "REPAYMENT", amount, orderId: null, createdAt: at(day) }) as const;
const voided = (day: number, amount: number, orderId: string) =>
  ({ type: "CHARGE_VOID", amount, orderId, createdAt: at(day) }) as const;

describe("oldestUnpaidAt", () => {
  it("is null when nothing is owed", () => {
    expect(oldestUnpaidAt([])).toBeNull();
    expect(oldestUnpaidAt([charge(1, 100), repay(2, 100)])).toBeNull();
  });

  it("pays off the oldest bills first", () => {
    const entries = [charge(1, 100), charge(5, 200), repay(6, 150)];
    expect(oldestUnpaidAt(entries)).toBe(at(5)); // bill of the 1st paid off, 5th has 150 left
  });

  it("a voided bill doesn't count as unpaid", () => {
    expect(oldestUnpaidAt([charge(1, 100, "a"), charge(3, 50, "b"), voided(4, 100, "a")])).toBe(
      at(3),
    );
  });

  it("money already paid on a voided bill goes to the next bills", () => {
    // 100 paid on bill a (fully), then a is voided → that 100 now pays bill b
    const entries = [charge(1, 100, "a"), repay(2, 100), charge(3, 80, "b"), voided(4, 100, "a")];
    expect(oldestUnpaidAt(entries)).toBeNull();
  });

  it("credit left over pays the next new bill", () => {
    const entries = [charge(1, 100, "a"), repay(2, 100), voided(3, 100, "a"), charge(5, 150, "b")];
    expect(oldestUnpaidAt(entries)).toBe(at(5)); // 100 credit used, 50 still owed on b
  });
});

describe("customer and repayment input", () => {
  it("cleans up a new customer", () => {
    expect(customerInputSchema.parse({ name: "  Somchai  K ", phone: " ", note: "" })).toEqual({
      name: "Somchai K",
      phone: null,
      note: null,
    });
    expect(customerInputSchema.safeParse({ name: "A", phone: "08x" }).success).toBe(false);
  });

  it("needs an amount and a method", () => {
    const id = "3f1c2b9a-7d4e-4c1a-9b8e-2a6f0d5c1e77";
    expect(
      repaymentInputSchema.safeParse({ customerId: id, amount: 30000, method: "CASH" }).success,
    ).toBe(true);
    expect(
      repaymentInputSchema.safeParse({ customerId: id, amount: 0, method: "CASH" }).success,
    ).toBe(false);
    expect(
      repaymentInputSchema.safeParse({ customerId: id, amount: 100, method: "CREDIT" }).success,
    ).toBe(false);
  });
});
