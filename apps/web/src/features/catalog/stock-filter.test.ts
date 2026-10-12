import type { Product } from "@pos/shared";
import { describe, expect, it } from "vitest";
import { filterStock, NO_CATEGORY } from "./stock-filter";

let n = 0;
const make = (overrides: Partial<Product>): Product => ({
  id: `p${++n}`,
  barcode: `88500000000${n}`,
  sku: `SKU-0000${n}`,
  name: `Item ${n}`,
  category: null,
  price: 1000,
  cost: null,
  stockQty: 20,
  lowStockAt: 5,
  isActive: true,
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

const drinks = { id: "c1", name: "Drinks" };
const water = make({ name: "Drinking water", barcode: "8850000000011", category: drinks });
const soy = make({ name: "Soy milk", stockQty: 0, category: drinks });
const oil = make({ name: "Cooking oil", stockQty: 3, sku: "GR-0107" });
const old = make({ name: "Old snack", isActive: false });
const all = [water, soy, oil, old];

const names = (rows: Product[]) => rows.map((p) => p.name);

describe("filterStock", () => {
  it("lists active items with Out first, then Low, then by name", () => {
    const { rows, counts } = filterStock(all, { search: "", view: "all", category: "" });
    expect(names(rows)).toEqual(["Soy milk", "Cooking oil", "Drinking water"]);
    expect(counts).toEqual({ all: 3, low: 1, out: 1, off: 1 });
  });

  it("filters by chip", () => {
    expect(names(filterStock(all, { search: "", view: "low", category: "" }).rows)).toEqual([
      "Cooking oil",
    ]);
    expect(names(filterStock(all, { search: "", view: "out", category: "" }).rows)).toEqual([
      "Soy milk",
    ]);
    expect(names(filterStock(all, { search: "", view: "off", category: "" }).rows)).toEqual([
      "Old snack",
    ]);
  });

  it("searches name, SKU and barcode, and the counts follow the search", () => {
    expect(names(filterStock(all, { search: "MILK", view: "all", category: "" }).rows)).toEqual([
      "Soy milk",
    ]);
    expect(names(filterStock(all, { search: "gr-01", view: "all", category: "" }).rows)).toEqual([
      "Cooking oil",
    ]);
    const scan = filterStock(all, { search: "8850000000011", view: "all", category: "" });
    expect(names(scan.rows)).toEqual(["Drinking water"]);
    expect(scan.counts).toEqual({ all: 1, low: 0, out: 0, off: 0 });
  });

  it("filters by category, including items without one", () => {
    expect(names(filterStock(all, { search: "", view: "all", category: "c1" }).rows)).toEqual([
      "Soy milk",
      "Drinking water",
    ]);
    expect(
      names(filterStock(all, { search: "", view: "all", category: NO_CATEGORY }).rows),
    ).toEqual(["Cooking oil"]);
  });
});
