import { describe, expect, it } from "vitest";
import { customerNameKey, customerNameSchema } from "./credit";
import { checkoutInputSchema } from "./orders";
import { sameAmountIds } from "./promptpay";

describe("sameAmountIds", () => {
  const bill = (orderId: string, total: number, time: string) => ({
    orderId,
    total,
    createdAt: `2026-10-13T${time}:00.000Z`,
  });

  it("flags pending bills with the same amount within 30 minutes", () => {
    const flagged = sameAmountIds([
      bill("a", 4500, "07:00"),
      bill("b", 4500, "07:20"), // 20 min after a → both flagged
      bill("c", 4500, "09:00"), // far from the others
      bill("d", 12000, "07:05"),
    ]);
    expect([...flagged].sort()).toEqual(["a", "b"]);
  });
});

describe("customer names", () => {
  it("normalises names and keys", () => {
    expect(customerNameSchema.parse("  Somchai   K ")).toBe("Somchai K");
    expect(customerNameKey("  Somchai   K ")).toBe("somchai k");
    expect(customerNameSchema.safeParse("  ").success).toBe(false);
  });
});

describe("payment input", () => {
  const ID = "3f1c2b9a-7d4e-4c1a-9b8e-2a6f0d5c1e77";
  const base = {
    terminalId: ID,
    items: [{ productId: ID, qty: 1 }],
    discount: null,
    clientCreatedAt: "2026-10-13T14:05:00.000+07:00",
  };

  it("accepts PromptPay and credit (existing or new customer)", () => {
    for (const payment of [
      { method: "PROMPTPAY" },
      { method: "CREDIT", customer: { id: ID } },
      { method: "CREDIT", customer: { newName: "Somchai" } },
    ]) {
      expect(checkoutInputSchema.safeParse({ ...base, payment }).success).toBe(true);
    }
  });

  it("needs a customer for credit", () => {
    expect(checkoutInputSchema.safeParse({ ...base, payment: { method: "CREDIT" } }).success).toBe(
      false,
    );
    expect(
      checkoutInputSchema.safeParse({
        ...base,
        payment: { method: "CREDIT", customer: { newName: " " } },
      }).success,
    ).toBe(false);
  });
});
