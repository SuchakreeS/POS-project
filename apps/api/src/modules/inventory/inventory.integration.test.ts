/**
 * Restock / adjust / movement history against a real database (needs TEST_DATABASE_URL, see README).
 * Only touches products whose barcode starts with "ITINV-" and users "itestinv_…".
 */
import type { Movement, Product } from "@pos/shared";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { createTestUser, dbTestsEnabled, deleteTestUsers } from "../../test/db-helpers";

const app = createApp();
const USER_PREFIX = "itestinv_";
let headers: Record<string, string>;

async function cleanup() {
  const products = await prisma.product.findMany({ where: { barcode: { startsWith: "ITINV-" } } });
  const ids = products.map((p) => p.id);
  await prisma.auditLog.deleteMany({
    where: { OR: [{ entityId: { in: ids } }, { userName: { startsWith: USER_PREFIX } }] },
  });
  await prisma.stockMovement.deleteMany({ where: { productId: { in: ids } } });
  await prisma.product.deleteMany({ where: { id: { in: ids } } });
}

const post = (path: string, body: object) => request(app).post(path).set(headers).send(body);
const get = (path: string, query: Record<string, string | number> = {}) =>
  request(app).get(path).query(query).set(headers);

async function newProduct(barcode: string, startingStock: number): Promise<Product> {
  const res = await post("/products", {
    barcode,
    name: `Inv ${barcode}`,
    categoryId: null,
    sku: "",
    price: 1000,
    cost: null,
    lowStockAt: 5,
    startingStock,
  });
  expect(res.status).toBe(201);
  return res.body;
}

const stockOf = async (id: string) =>
  (await prisma.product.findUniqueOrThrow({ where: { id } })).stockQty;
const movementSum = async (id: string) =>
  (await prisma.stockMovement.aggregate({ where: { productId: id }, _sum: { qty: true } }))._sum
    .qty;

describe.skipIf(!dbTestsEnabled)("inventory API (database)", () => {
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

  describe("restock", () => {
    it("adds stock to several items in one go, with one audit entry", async () => {
      const a = await newProduct("ITINV-A", 3);
      const b = await newProduct("ITINV-B", 0);

      const res = await post("/inventory/restock", {
        items: [
          { productId: a.id, qty: 24 },
          { productId: b.id, qty: 6 },
          { productId: a.id, qty: 1 }, // same item twice is added up
        ],
        note: "Makro invoice 1234",
      });

      expect(res.status).toBe(200);
      expect(res.body.items.map((p: Product) => [p.name, p.stockQty]).sort()).toEqual([
        ["Inv ITINV-A", 28],
        ["Inv ITINV-B", 6],
      ]);
      expect(await movementSum(a.id)).toBe(28);

      const movements = await prisma.stockMovement.findMany({
        where: { productId: a.id, type: "RESTOCK" },
      });
      expect(movements).toMatchObject([{ qty: 25, reason: "Makro invoice 1234" }]);

      const audit = await prisma.auditLog.findMany({
        where: { action: "STOCK_RESTOCK", userName: `${USER_PREFIX}nok` },
      });
      expect(audit).toHaveLength(1);
      expect(audit[0]?.reason).toBe("Makro invoice 1234");
      expect(audit[0]?.after).toMatchObject({
        items: expect.arrayContaining([
          expect.objectContaining({ name: "Inv ITINV-A", qty: 25, stockBefore: 3, stockAfter: 28 }),
        ]),
      });
    });

    it("saves nothing if one item is missing or a quantity is bad", async () => {
      const a = await newProduct("ITINV-A", 3);

      const missing = await post("/inventory/restock", {
        items: [
          { productId: a.id, qty: 5 },
          { productId: "00000000-0000-4000-8000-000000000000", qty: 5 },
        ],
      });
      expect(missing.status).toBe(400);

      const zero = await post("/inventory/restock", { items: [{ productId: a.id, qty: 0 }] });
      expect(zero.status).toBe(400);
      expect(zero.body.error.message).toBe("Quantity must be at least 1");

      expect(await stockOf(a.id)).toBe(3);
    });
  });

  describe("adjust", () => {
    it("removes, adds and sets a count, keeping movements and stock in step", async () => {
      const p = await newProduct("ITINV-A", 24);

      const removed = await post("/inventory/adjust", {
        productId: p.id,
        mode: "REMOVE",
        qty: 3,
        reason: "Damaged",
        note: "dented cans",
      });
      expect(removed.body.stockQty).toBe(21);

      const added = await post("/inventory/adjust", {
        productId: p.id,
        mode: "ADD",
        qty: 2,
        reason: "Found extra",
      });
      expect(added.body.stockQty).toBe(23);

      const counted = await post("/inventory/adjust", {
        productId: p.id,
        mode: "SET",
        qty: 20,
        reason: "Count correction",
      });
      expect(counted.body.stockQty).toBe(20);
      expect(await movementSum(p.id)).toBe(20);

      const adjustments = await prisma.stockMovement.findMany({
        where: { productId: p.id, type: "ADJUST" },
        orderBy: { createdAt: "asc" },
      });
      expect(adjustments.map((m) => [m.qty, m.reason])).toEqual([
        [-3, "Damaged — dented cans"],
        [2, "Found extra"],
        [-3, "Count correction"],
      ]);

      const audit = await prisma.auditLog.findMany({
        where: { entityId: p.id, action: "STOCK_ADJUST" },
        orderBy: { createdAt: "asc" },
      });
      expect(audit[2]).toMatchObject({
        before: { stockQty: 23 },
        after: { stockQty: 20, mode: "SET", qty: 20, change: -3 },
      });
    });

    it("allows going below 0 (stock may be wrong), but not a count that changes nothing", async () => {
      const p = await newProduct("ITINV-A", 2);
      const below = await post("/inventory/adjust", {
        productId: p.id,
        mode: "REMOVE",
        qty: 5,
        reason: "Lost or stolen",
      });
      expect(below.body.stockQty).toBe(-3);

      const same = await post("/inventory/adjust", {
        productId: p.id,
        mode: "SET",
        qty: -1,
        reason: "Count correction",
      });
      expect(same.status).toBe(400); // negative count rejected by the schema

      const noChange = await post("/inventory/adjust", {
        productId: p.id,
        mode: "ADD",
        qty: 0,
        reason: "Found extra",
      });
      expect(noChange.status).toBe(400);
    });

    it("checks the reason fits the mode and needs a note for Other", async () => {
      const p = await newProduct("ITINV-A", 10);
      const wrong = await post("/inventory/adjust", {
        productId: p.id,
        mode: "ADD",
        qty: 1,
        reason: "Damaged",
      });
      expect(wrong.status).toBe(400);
      const other = await post("/inventory/adjust", {
        productId: p.id,
        mode: "REMOVE",
        qty: 1,
        reason: "Other",
      });
      expect(other.body.error.message).toBe("Say what happened");

      const unchanged = await post("/inventory/adjust", {
        productId: p.id,
        mode: "SET",
        qty: 10,
        reason: "Count correction",
      });
      expect(unchanged.status).toBe(400);
      expect(unchanged.body.error.message).toBe("Stock is already 10. Nothing to change.");
    });
  });

  describe("movement history", () => {
    it("lists newest first with stock after each movement, filters and pages", async () => {
      const p = await newProduct("ITINV-A", 10); // INITIAL +10 → 10
      await post("/inventory/restock", { items: [{ productId: p.id, qty: 5 }] }); // → 15
      await post("/inventory/adjust", {
        productId: p.id,
        mode: "REMOVE",
        qty: 4,
        reason: "Expired",
      }); // → 11
      await post("/inventory/restock", { items: [{ productId: p.id, qty: 1 }], note: "Top-up" }); // → 12

      const all = await get("/inventory/movements", { productId: p.id });
      expect(all.status).toBe(200);
      expect(all.body.items.map((m: Movement) => [m.type, m.qty, m.stockAfter])).toEqual([
        ["RESTOCK", 1, 12],
        ["ADJUST", -4, 11],
        ["RESTOCK", 5, 15],
        ["INITIAL", 10, 10],
      ]);
      expect(all.body.items[0]).toMatchObject({
        reason: "Top-up",
        userName: `${USER_PREFIX}nok`,
        order: null,
      });
      expect(all.body.nextCursor).toBeNull();

      // Stock-after stays right when filtered
      const adjustOnly = await get("/inventory/movements", { productId: p.id, filter: "adjust" });
      expect(adjustOnly.body.items.map((m: Movement) => m.stockAfter)).toEqual([11]);

      // Paging
      const first = await get("/inventory/movements", { productId: p.id, limit: 3 });
      expect(first.body.items).toHaveLength(3);
      const second = await get("/inventory/movements", {
        productId: p.id,
        limit: 3,
        cursor: first.body.nextCursor,
      });
      expect(second.body.items.map((m: Movement) => m.type)).toEqual(["INITIAL"]);
      expect(second.body.nextCursor).toBeNull();
    });

    it("404s for an unknown product", async () => {
      const res = await get("/inventory/movements", {
        productId: "00000000-0000-4000-8000-000000000000",
      });
      expect(res.status).toBe(404);
    });
  });
});
