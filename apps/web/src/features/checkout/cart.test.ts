import type { Product } from "@pos/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { buildCart, needsStockConfirm } from "./cart";
import { useCartStore } from "./cart-store";

const product = (id: string, price: number, overrides: Partial<Product> = {}): Product => ({
  id,
  barcode: id,
  sku: null,
  name: id,
  category: null,
  price,
  cost: null,
  stockQty: 10,
  lowStockAt: null,
  isActive: true,
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

const cart = () => useCartStore.getState();

beforeEach(() => cart().clear());

describe("cart store", () => {
  it("adds +1 for a repeat scan and selects the last scanned line", () => {
    cart().add("water");
    cart().add("chips");
    cart().add("water");
    expect(cart().lines).toEqual([
      { productId: "water", qty: 2 },
      { productId: "chips", qty: 1 },
    ]);
    expect(cart().selectedId).toBe("water");
  });

  it("removes a line when its quantity goes below 1, and selects the last line", () => {
    cart().add("water");
    cart().add("chips");
    cart().setQty("chips", 0);
    expect(cart().lines).toEqual([{ productId: "water", qty: 1 }]);
    expect(cart().selectedId).toBe("water");
  });

  it("drops the discount when the cart becomes empty", () => {
    cart().add("water");
    cart().setDiscount(500);
    cart().remove("water");
    expect(cart().discount).toBeNull();
  });

  it("caps quantities at 9,999", () => {
    cart().add("water", 20000);
    expect(cart().lines[0]?.qty).toBe(9999);
  });
});

describe("buildCart", () => {
  it("prices the lines and applies the discount like the API", () => {
    const view = buildCart(
      [
        { productId: "water", qty: 3 },
        { productId: "chips", qty: 1 },
      ],
      [product("water", 700), product("chips", 2000)],
      5000,
    );
    expect(view.totals).toEqual({
      subtotal: 4100,
      discountValue: 5000,
      discountAmount: 4100,
      total: 0,
    });
    expect(view.itemCount).toBe(4);
    expect(view.sellable).toBe(true);
  });

  it("flags items that were removed or turned off and leaves them out of the total", () => {
    const view = buildCart(
      [
        { productId: "water", qty: 1 },
        { productId: "gone", qty: 1 },
        { productId: "off", qty: 1 },
      ],
      [product("water", 700), product("off", 999, { isActive: false })],
      null,
    );
    expect(view.rows.map((row) => row.problem)).toEqual([
      null,
      "No longer in the system",
      "Turned off",
    ]);
    expect(view.totals.total).toBe(700);
    expect(view.sellable).toBe(false);
  });
});

describe("needsStockConfirm", () => {
  const oil = product("oil", 5500, { stockQty: 3 });
  const soy = product("soy", 1200, { stockQty: 0 });

  it("asks when the bill would hold more than the stock count", () => {
    expect(needsStockConfirm(oil, 3, [])).toBe(false);
    expect(needsStockConfirm(oil, 4, [])).toBe(true);
    expect(needsStockConfirm(soy, 1, [])).toBe(true);
  });

  it("asks only once per product per bill", () => {
    expect(needsStockConfirm(soy, 5, ["soy"])).toBe(false);
  });

  it("forgets the answer when the line is removed or the bill is cleared", () => {
    cart().add("soy");
    cart().allowOverStock("soy");
    expect(cart().overStockOk).toEqual(["soy"]);
    cart().remove("soy");
    expect(cart().overStockOk).toEqual([]);
    cart().allowOverStock("soy");
    cart().clear();
    expect(cart().overStockOk).toEqual([]);
  });
});
