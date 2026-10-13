import { describe, expect, it } from "vitest";
import { adjustDelta, adjustInputSchema, restockInputSchema } from "./inventory";

const ID = "3f1c2b9a-7d4e-4c1a-9b8e-2a6f0d5c1e77";
const messages = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message);

describe("adjustDelta", () => {
  it("signs the change by mode", () => {
    expect(adjustDelta("REMOVE", 3, 24)).toBe(-3);
    expect(adjustDelta("ADD", 2, 24)).toBe(2);
    expect(adjustDelta("SET", 21, 24)).toBe(-3);
    expect(adjustDelta("SET", 30, -2)).toBe(32);
  });
});

describe("adjustInputSchema", () => {
  const base = { productId: ID, mode: "REMOVE", qty: 3, reason: "Damaged" } as const;

  it("accepts a valid adjustment and turns an empty note into null", () => {
    expect(adjustInputSchema.parse({ ...base, note: "  " })).toEqual({ ...base, note: null });
  });

  it("allows a count of 0 but not removing or adding 0", () => {
    expect(
      adjustInputSchema.safeParse({ ...base, mode: "SET", qty: 0, reason: "Count correction" })
        .success,
    ).toBe(true);
    expect(messages(adjustInputSchema.safeParse({ ...base, qty: 0 }))).toEqual([
      "Quantity must be at least 1",
    ]);
  });

  it("needs a reason that fits the mode, and a note for Other", () => {
    expect(messages(adjustInputSchema.safeParse({ ...base, mode: "ADD" }))).toEqual([
      "Pick a reason",
    ]);
    expect(messages(adjustInputSchema.safeParse({ ...base, reason: "Other" }))).toEqual([
      "Say what happened",
    ]);
    expect(
      adjustInputSchema.safeParse({ ...base, reason: "Other", note: "Gave to staff" }).success,
    ).toBe(true);
  });
});

describe("restockInputSchema", () => {
  it("needs at least one item with a whole quantity above 0", () => {
    expect(messages(restockInputSchema.safeParse({ items: [] }))).toEqual([
      "Add at least one item",
    ]);
    expect(
      messages(restockInputSchema.safeParse({ items: [{ productId: ID, qty: 1.5 }] })),
    ).toEqual(["Quantity must be a whole number"]);
    expect(restockInputSchema.parse({ items: [{ productId: ID, qty: 24 }] })).toEqual({
      items: [{ productId: ID, qty: 24 }],
      note: null,
    });
  });
});
