import { describe, expect, it } from "vitest";
import {
  categoryInputSchema,
  productCreateSchema,
  productUpdateSchema,
  stockStatus,
  unitProfit,
} from "./catalog";

describe("stockStatus", () => {
  it("is OUT at 0 or below, LOW at or under the alert, OK otherwise", () => {
    expect(stockStatus({ stockQty: 0, lowStockAt: 5 })).toBe("OUT");
    expect(stockStatus({ stockQty: -2, lowStockAt: null })).toBe("OUT");
    expect(stockStatus({ stockQty: 5, lowStockAt: 5 })).toBe("LOW");
    expect(stockStatus({ stockQty: 6, lowStockAt: 5 })).toBe("OK");
    expect(stockStatus({ stockQty: 1, lowStockAt: null })).toBe("OK"); // no alert set
  });
});

describe("unitProfit", () => {
  it("returns profit and margin, or null without a cost", () => {
    expect(unitProfit(700, 450)).toEqual({ profit: 250, marginPercent: 35.7 });
    expect(unitProfit(700, 900)).toEqual({ profit: -200, marginPercent: -28.6 });
    expect(unitProfit(700, null)).toBeNull();
  });
});

const item = {
  barcode: " 8850000000011 ",
  name: "  Drinking   water ",
  categoryId: null,
  sku: "",
  price: 700,
  cost: null,
  lowStockAt: 5,
  startingStock: 0,
};

describe("productCreateSchema", () => {
  it("cleans up text and turns an empty SKU into null (auto)", () => {
    expect(productCreateSchema.parse(item)).toMatchObject({
      barcode: "8850000000011",
      name: "Drinking water",
      sku: null,
    });
    expect(productCreateSchema.parse({ ...item, sku: " dr-01 " }).sku).toBe("DR-01");
  });

  it.each([
    [{ barcode: "" }, "Scan or type the barcode"],
    [{ barcode: "885 000" }, "Barcode can only have letters, numbers and dashes"],
    [{ name: "   " }, "Enter the item name"],
    [{ price: 0 }, "Selling price must be more than 0"],
    [{ price: 12.5 }, "Amount must be whole satang"],
    [{ startingStock: -1 }, "Starting stock can't be negative"],
    [{ startingStock: 1.5 }, "Starting stock must be a whole number"],
    [{ categoryId: "drinks" }, "Pick a category from the list"],
    [{ sku: "a b" }, "SKU can only have letters, numbers, dot, dash or underscore"],
  ])("rejects %j", (change, message) => {
    const result = productCreateSchema.safeParse({ ...item, ...change });
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});

describe("productUpdateSchema", () => {
  it("accepts partial updates and drops unknown fields like stockQty", () => {
    expect(productUpdateSchema.parse({ price: 800, stockQty: 99 })).toEqual({ price: 800 });
  });

  it("keeps a cleared SKU as null", () => {
    expect(productUpdateSchema.parse({ sku: "" })).toEqual({ sku: null });
  });
});

describe("categoryInputSchema", () => {
  it("trims and collapses spaces", () => {
    expect(categoryInputSchema.parse({ name: "  Dry   food " })).toEqual({ name: "Dry food" });
    expect(categoryInputSchema.safeParse({ name: " " }).success).toBe(false);
  });
});
