/**
 * Products + categories API against a real database (needs TEST_DATABASE_URL, see README).
 * Only touches rows whose barcode starts with "ITEST-", categories named "itest …" and users "itestcat_…".
 */
import type { Product } from "@pos/shared";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { createTestUser, dbTestsEnabled, deleteTestUsers } from "../../test/db-helpers";

const app = createApp();
const USER_PREFIX = "itestcat_";
let headers: Record<string, string>;

async function cleanup() {
  const products = await prisma.product.findMany({ where: { barcode: { startsWith: "ITEST-" } } });
  const productIds = products.map((p) => p.id);
  const categories = await prisma.category.findMany({ where: { name: { startsWith: "itest " } } });
  const categoryIds = categories.map((c) => c.id);
  await prisma.auditLog.deleteMany({
    where: { entityId: { in: [...productIds, ...categoryIds] } },
  });
  await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
}

const newItem = (overrides: Record<string, unknown> = {}) => ({
  barcode: "ITEST-0001",
  name: "  Test   water 600 ml ",
  categoryId: null,
  sku: "",
  price: 700,
  cost: 450,
  lowStockAt: 5,
  startingStock: 24,
  ...overrides,
});

const post = (path: string, body: object) => request(app).post(path).set(headers).send(body);
const patch = (path: string, body: object) => request(app).patch(path).set(headers).send(body);
const get = (path: string) => request(app).get(path).set(headers);

const auditFor = (entityId: string) =>
  prisma.auditLog.findMany({ where: { entityId }, orderBy: { createdAt: "asc" } });

describe.skipIf(!dbTestsEnabled)("products + categories API (database)", () => {
  beforeAll(async () => {
    await deleteTestUsers(USER_PREFIX);
    ({ headers } = await createTestUser(`${USER_PREFIX}nok`));
  });
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await deleteTestUsers(USER_PREFIX);
    await prisma.$disconnect();
  });

  it("needs a login", async () => {
    expect((await request(app).get("/products")).status).toBe(401);
    expect((await request(app).get("/categories")).status).toBe(401);
  });

  describe("categories", () => {
    it("creates, lists and renames, ignoring case for duplicates", async () => {
      const created = await post("/categories", { name: " itest  Drinks " });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ name: "itest Drinks", productCount: 0 });

      const duplicate = await post("/categories", { name: "ITEST DRINKS" });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.issues).toEqual([
        { path: ["name"], message: `There's already a category called "itest Drinks".` },
      ]);

      const renamed = await patch(`/categories/${created.body.id}`, { name: "itest Beverages" });
      expect(renamed.body.name).toBe("itest Beverages");

      const list = await get("/categories");
      expect(list.body.items.map((c: { name: string }) => c.name)).toContain("itest Beverages");

      const audit = await auditFor(created.body.id);
      expect(audit.map((a) => a.action)).toEqual(["CATEGORY_CREATE", "CATEGORY_UPDATE"]);
      expect(audit[1]).toMatchObject({
        before: { name: "itest Drinks" },
        after: { name: "itest Beverages" },
      });
    });
  });

  describe("create", () => {
    it("saves the item, its starting stock and the audit entry together", async () => {
      const category = (await post("/categories", { name: "itest Drinks" })).body;
      const res = await post("/products", newItem({ categoryId: category.id }));

      expect(res.status).toBe(201);
      const product: Product = res.body;
      expect(product).toMatchObject({
        name: "Test water 600 ml",
        category: { id: category.id, name: "itest Drinks" },
        price: 700,
        cost: 450,
        stockQty: 24,
        isActive: true,
      });
      expect(product.sku).toMatch(/^SKU-\d{5}$/);

      const movements = await prisma.stockMovement.findMany({ where: { productId: product.id } });
      expect(movements).toMatchObject([{ type: "INITIAL", qty: 24 }]);

      const [audit] = await auditFor(product.id);
      expect(audit).toMatchObject({
        action: "PRODUCT_CREATE",
        userName: `${USER_PREFIX}nok`,
        after: { name: "Test water 600 ml", category: "itest Drinks", startingStock: 24 },
      });
    });

    it("creates no movement for starting stock 0", async () => {
      const product = (await post("/products", newItem({ startingStock: 0 }))).body;
      expect(await prisma.stockMovement.count({ where: { productId: product.id } })).toBe(0);
    });

    it("gives automatic SKUs in order and keeps typed ones (uppercase)", async () => {
      const first = (await post("/products", newItem())).body;
      const second = (await post("/products", newItem({ barcode: "ITEST-0002" }))).body;
      const typed = (await post("/products", newItem({ barcode: "ITEST-0003", sku: "dr-0099" })))
        .body;

      const n = Number(first.sku.slice(4));
      expect(second.sku).toBe(`SKU-${String(n + 1).padStart(5, "0")}`);
      expect(typed.sku).toBe("DR-0099");
    });

    it("names the item that already uses a barcode or SKU", async () => {
      await post("/products", newItem({ sku: "ITEST-SKU" }));

      const sameBarcode = await post("/products", newItem({ name: "Other" }));
      expect(sameBarcode.status).toBe(409);
      expect(sameBarcode.body.error.issues).toEqual([
        { path: ["barcode"], message: 'This barcode is already used by "Test water 600 ml".' },
      ]);

      const sameSku = await post("/products", newItem({ barcode: "ITEST-0009", sku: "itest-sku" }));
      expect(sameSku.status).toBe(409);
      expect(sameSku.body.error.issues[0].path).toEqual(["sku"]);
    });

    it("rejects bad input with field messages", async () => {
      const res = await post("/products", newItem({ name: " ", price: 0, startingStock: -1 }));
      expect(res.status).toBe(400);
      const messages = res.body.error.issues.map((i: { message: string }) => i.message);
      expect(messages).toEqual(
        expect.arrayContaining(["Enter the item name", "Selling price must be more than 0"]),
      );
    });
  });

  describe("read", () => {
    it("searches by name, SKU or barcode and finds by exact barcode", async () => {
      const water = (await post("/products", newItem())).body;
      await post(
        "/products",
        newItem({ barcode: "ITEST-0002", name: "Test chips", sku: "ITEST-CHIPS" }),
      );

      const byName = await get("/products").query({ search: "TEST WATER" });
      expect(byName.body.items.map((p: Product) => p.id)).toEqual([water.id]);

      const bySku = await get("/products").query({ search: "itest-chi" });
      expect(bySku.body.items.map((p: Product) => p.name)).toEqual(["Test chips"]);

      const byBarcode = await get("/products/barcode/ITEST-0001");
      expect(byBarcode.body.id).toBe(water.id);

      const unknown = await get("/products/barcode/ITEST-404");
      expect(unknown.status).toBe(404);
      expect(unknown.body.error.message).toBe(
        "Barcode not found — ITEST-404 isn't in the system yet.",
      );
    });
  });

  describe("update", () => {
    it("logs price changes and other edits separately, with only what changed", async () => {
      const product = (await post("/products", newItem())).body;
      const res = await patch(`/products/${product.id}`, {
        price: 800,
        name: "Test water 600ml",
        lowStockAt: 10,
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        price: 800,
        name: "Test water 600ml",
        lowStockAt: 10,
        stockQty: 24,
      });

      const audit = await auditFor(product.id);
      expect(audit.map((a) => a.action)).toEqual([
        "PRODUCT_CREATE",
        "PRICE_CHANGE",
        "PRODUCT_UPDATE",
      ]);
      expect(audit[1]).toMatchObject({ before: { price: 700 }, after: { price: 800 } });
      expect(audit[2]).toMatchObject({
        before: { name: "Test water 600 ml", lowStockAt: 5 },
        after: { name: "Test water 600ml", lowStockAt: 10 },
      });
    });

    it("writes no audit entry when nothing changed, and ignores stock in the body", async () => {
      const product = (await post("/products", newItem())).body;
      const res = await patch(`/products/${product.id}`, { price: 700, stockQty: 999 });
      expect(res.body.stockQty).toBe(24);
      expect((await auditFor(product.id)).map((a) => a.action)).toEqual(["PRODUCT_CREATE"]);
    });

    it("rejects a barcode used by another item", async () => {
      await post("/products", newItem());
      const other = (await post("/products", newItem({ barcode: "ITEST-0002", name: "Other" })))
        .body;
      const res = await patch(`/products/${other.id}`, { barcode: "ITEST-0001" });
      expect(res.status).toBe(409);
    });
  });

  describe("deactivate", () => {
    it("hides the item from the active list and back, logged once each way", async () => {
      const product = (await post("/products", newItem())).body;

      const off = await post(`/products/${product.id}/deactivate`, { reason: "No longer sold" });
      expect(off.body.isActive).toBe(false);
      await post(`/products/${product.id}/deactivate`, {}); // twice = no-op

      const active = await get("/products").query({ search: "ITEST-0001" });
      expect(active.body.items).toEqual([]);
      const inactive = await get("/products").query({ search: "ITEST-0001", status: "inactive" });
      expect(inactive.body.items).toHaveLength(1);

      await post(`/products/${product.id}/reactivate`, {});
      const audit = await auditFor(product.id);
      expect(audit.map((a) => a.action)).toEqual([
        "PRODUCT_CREATE",
        "PRODUCT_DEACTIVATE",
        "PRODUCT_REACTIVATE",
      ]);
      expect(audit[1]?.reason).toBe("No longer sold");
    });
  });
});
