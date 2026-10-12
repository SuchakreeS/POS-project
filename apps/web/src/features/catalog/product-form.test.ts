import type { Product } from "@pos/shared";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/http-client";
import {
  changedFields,
  emptyProductForm,
  isDirty,
  parseProductForm,
  productToForm,
  serverFieldErrors,
  type ProductFormValues,
} from "./product-form";

const CATEGORY = "3f1c2b9a-7d4e-4c1a-9b8e-2a6f0d5c1e77";

const filled = (overrides: Partial<ProductFormValues> = {}): ProductFormValues => ({
  ...emptyProductForm({ lowStockAt: 5 }),
  barcode: "8850000000011",
  name: "Drinking water",
  price: "7",
  cost: "4.50",
  startingStock: "24",
  ...overrides,
});

const product: Product = {
  id: "p1",
  barcode: "8850000000011",
  sku: "DR-0001",
  name: "Drinking water",
  category: { id: CATEGORY, name: "Drinks" },
  price: 700,
  cost: 450,
  stockQty: 48,
  lowStockAt: 5,
  isActive: true,
  createdAt: "",
  updatedAt: "",
};

describe("parseProductForm", () => {
  it("turns typed text into the API body (money in satang)", () => {
    expect(parseProductForm(filled({ sku: " ", lowStockAt: "" }), "create")).toEqual({
      ok: true,
      data: {
        barcode: "8850000000011",
        name: "Drinking water",
        categoryId: null,
        sku: " ",
        price: 700,
        cost: 450,
        lowStockAt: null,
        startingStock: 24,
      },
    });
  });

  it("explains each problem under its field", () => {
    const result = parseProductForm(
      filled({
        barcode: "",
        name: " ",
        price: "",
        cost: "4.555",
        startingStock: "two",
        lowStockAt: "-1",
      }),
      "create",
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        price: "Enter the selling price",
        cost: "Enter an amount like 12.50",
        startingStock: "Enter a whole number, like 12",
        lowStockAt: "Enter a whole number, like 12",
        barcode: "Scan or type the barcode",
        name: "Enter the item name",
      },
    });
  });

  it("uses the schema's message for a zero price", () => {
    const result = parseProductForm(filled({ price: "0" }), "create");
    expect(result).toMatchObject({
      ok: false,
      errors: { price: "Selling price must be more than 0" },
    });
  });

  it("ignores starting stock when editing", () => {
    expect(parseProductForm(filled({ startingStock: "oops" }), "edit").ok).toBe(true);
  });
});

describe("changedFields", () => {
  const edit = (overrides: Partial<ProductFormValues>) => {
    const result = parseProductForm({ ...productToForm(product), ...overrides }, "edit");
    if (!result.ok) throw new Error("form should be valid");
    return changedFields(product, result.data);
  };

  it("is empty when nothing changed, even with extra spaces or 7 vs 7.00", () => {
    expect(edit({ name: " Drinking  water ", price: "7.00" })).toEqual({});
  });

  it("returns only what changed", () => {
    expect(edit({ price: "8", lowStockAt: "10", categoryId: null })).toEqual({
      price: 800,
      lowStockAt: 10,
      categoryId: null,
    });
  });
});

describe("serverFieldErrors", () => {
  it("maps API issues to fields", () => {
    const error = new ApiError(409, "CONFLICT", "dup", [
      { path: ["barcode"], message: 'This barcode is already used by "Soy milk".' },
    ]);
    expect(serverFieldErrors(error)).toEqual({
      barcode: 'This barcode is already used by "Soy milk".',
    });
  });

  it("returns null when there's nothing field-specific", () => {
    expect(serverFieldErrors(new ApiError(500, "INTERNAL", "x"))).toBeNull();
    expect(
      serverFieldErrors(new ApiError(400, "VALIDATION", "x", [{ path: ["other"], message: "x" }])),
    ).toBeNull();
  });
});

describe("isDirty", () => {
  it("notices any change", () => {
    const initial = productToForm(product);
    expect(isDirty(initial, initial)).toBe(false);
    expect(isDirty({ ...initial, cost: "5" }, initial)).toBe(true);
  });
});
