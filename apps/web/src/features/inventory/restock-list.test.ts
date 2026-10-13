import type { Product } from "@pos/shared";
import { describe, expect, it } from "vitest";
import {
  addToList,
  emptyRestockList,
  parseQty,
  removeFromList,
  setQty,
  summarize,
  toRestockInput,
} from "./restock-list";

const product = (id: string): Product => ({
  id,
  barcode: id,
  sku: null,
  name: id,
  category: null,
  price: 100,
  cost: null,
  stockQty: 0,
  lowStockAt: null,
  isActive: true,
  createdAt: "",
  updatedAt: "",
});

describe("restock list", () => {
  it("adds new items on top and +1 on a repeat scan", () => {
    let list = addToList(emptyRestockList, product("a"));
    list = addToList(list, product("b"));
    list = addToList(list, product("a"));
    expect(list.rows.map((row) => [row.product.id, row.qty])).toEqual([
      ["b", "1"],
      ["a", "2"],
    ]);
    expect(list.lastId).toBe("a");
  });

  it("edits, removes and summarizes", () => {
    let list = addToList(addToList(emptyRestockList, product("a")), product("b"));
    list = setQty(list, "a", "24");
    expect(summarize(list)).toEqual({ products: 2, pieces: 25, valid: true });

    list = setQty(list, "b", "0");
    expect(summarize(list).valid).toBe(false);

    list = removeFromList(list, "b");
    expect(list.lastId).toBeNull();
    expect(toRestockInput(list, "INV-9")).toEqual({
      items: [{ productId: "a", qty: 24 }],
      note: "INV-9",
    });
  });

  it("only accepts whole numbers from 1", () => {
    expect([parseQty("12"), parseQty(" 3 "), parseQty("0"), parseQty("1.5"), parseQty("")]).toEqual(
      [12, 3, null, null, null],
    );
  });
});
