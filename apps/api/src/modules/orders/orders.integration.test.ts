/**
 * Checkout against a real database (needs TEST_DATABASE_URL, see README).
 * Uses its own terminal "ITX", products with barcodes "ITORD-…" and users "itestord_…".
 */
import type { Order, Product } from "@pos/shared";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import {
  createTestUser,
  dbTestsEnabled,
  deleteTerminalOrders,
  deleteTestCustomers,
  deleteTestUsers,
} from "../../test/db-helpers";

const app = createApp();
const USER_PREFIX = "itestord_";
let headers: Record<string, string>;
let terminalId: string;

async function cleanup() {
  const terminal = await prisma.terminal.findUnique({ where: { code: "ITX" } });
  if (terminal) await deleteTerminalOrders(terminal.id);
  await deleteTestCustomers("itest ");
  // Products made by these tests, with their opening-stock movements and audit rows.
  const products = await prisma.product.findMany({ where: { barcode: { startsWith: "ITORD-" } } });
  const productIds = products.map((p) => p.id);
  await prisma.auditLog.deleteMany({ where: { entityId: { in: productIds } } });
  await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  if (terminal)
    await prisma.terminal.update({ where: { id: terminal.id }, data: { lastBillSeq: 0 } });
}

const post = (path: string, body: object, extra: Record<string, string> = {}) =>
  request(app).post(path).set(headers).set(extra).send(body);

async function newProduct(barcode: string, price: number, startingStock: number): Promise<Product> {
  const res = await post("/products", {
    barcode,
    name: `Item ${barcode}`,
    categoryId: null,
    sku: "",
    price,
    cost: null,
    lowStockAt: null,
    startingStock,
  });
  expect(res.status).toBe(201);
  return res.body;
}

const sale = (body: Partial<Record<string, unknown>>, key = randomUUID()) =>
  post(
    "/orders",
    {
      terminalId,
      discount: null,
      clientCreatedAt: new Date().toISOString(),
      ...body,
    },
    { "Idempotency-Key": key },
  );

const stockOf = async (id: string) =>
  (await prisma.product.findUniqueOrThrow({ where: { id } })).stockQty;

describe.skipIf(!dbTestsEnabled)("checkout API (database)", () => {
  beforeAll(async () => {
    await deleteTestUsers(USER_PREFIX);
    ({ headers } = await createTestUser(`${USER_PREFIX}nok`));
    const terminal = await prisma.terminal.upsert({
      where: { code: "ITX" },
      update: {},
      create: { code: "ITX", name: "Integration test" },
    });
    terminalId = terminal.id;
  });
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.terminal.deleteMany({ where: { code: "ITX" } });
    await deleteTestUsers(USER_PREFIX);
    await prisma.$disconnect();
  });

  it("saves a cash sale: bill number, snapshots, totals, change, stock and audit", async () => {
    const water = await newProduct("ITORD-1", 700, 10);
    const chips = await newProduct("ITORD-2", 2000, 1);

    const res = await sale({
      items: [
        { productId: water.id, qty: 2 },
        { productId: chips.id, qty: 2 }, // more than in stock: allowed
        { productId: water.id, qty: 1 }, // same item twice is added up
      ],
      discount: { type: "FIXED", value: 1000 },
      payment: { method: "CASH", cashReceived: 10000 },
    });

    expect(res.status).toBe(201);
    const order: Order = res.body.order;
    expect(res.body.customerBalance).toBeNull();
    expect(order).toMatchObject({
      billNo: "ITX-000001",
      status: "COMPLETED",
      terminalCode: "ITX",
      cashierName: `${USER_PREFIX}nok`,
      subtotal: 6100, // 3 × 7.00 + 2 × 20.00
      discountValue: 1000,
      discountAmount: 1000,
      total: 5100,
      paymentMethod: "CASH",
      cashReceived: 10000,
      changeGiven: 4900,
    });
    expect(order.items).toEqual(
      expect.arrayContaining([
        {
          productId: water.id,
          productName: "Item ITORD-1",
          unitPrice: 700,
          qty: 3,
          lineTotal: 2100,
        },
        {
          productId: chips.id,
          productName: "Item ITORD-2",
          unitPrice: 2000,
          qty: 2,
          lineTotal: 4000,
        },
      ]),
    );

    expect(await stockOf(water.id)).toBe(7);
    expect(await stockOf(chips.id)).toBe(-1);
    const movements = await prisma.stockMovement.findMany({ where: { orderId: order.id } });
    expect(movements.map((m) => m.qty).sort((a, b) => a - b)).toEqual([-3, -2]);

    const audit = await prisma.auditLog.findMany({
      where: { entityId: order.id },
      orderBy: { action: "asc" },
    });
    expect(audit.map((a) => a.action)).toEqual(["DISCOUNT_APPLIED", "ORDER_CREATE"]);
    expect(audit[0]?.after).toMatchObject({ typed: 1000, applied: 1000, subtotal: 6100 });
    expect(audit[1]).toMatchObject({
      terminalId,
      after: { billNo: "ITX-000001", total: 5100, itemCount: 5 },
    });

    const second = await sale({
      items: [{ productId: water.id, qty: 1 }],
      payment: { method: "CASH", cashReceived: 700 },
    });
    expect(second.body.order.billNo).toBe("ITX-000002");
  });

  it("uses today's price even if the client shows an old one, and keeps old bills unchanged", async () => {
    const water = await newProduct("ITORD-1", 700, 10);
    const first = await sale({
      items: [{ productId: water.id, qty: 1 }],
      payment: { method: "CASH", cashReceived: 1000 },
    });
    await request(app).patch(`/products/${water.id}`).set(headers).send({ price: 800 });
    const second = await sale({
      items: [{ productId: water.id, qty: 1 }],
      payment: { method: "CASH", cashReceived: 1000 },
    });

    expect(second.body.order.total).toBe(800);
    const stored = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: first.body.order.id },
    });
    expect(stored.unitPrice).toBe(700);
  });

  it("caps the discount so the total is 0, not negative", async () => {
    const water = await newProduct("ITORD-1", 5000, 10);
    const res = await sale({
      items: [{ productId: water.id, qty: 1 }],
      discount: { type: "FIXED", value: 8000 },
      payment: { method: "CASH", cashReceived: 0 },
    });
    expect(res.body.order).toMatchObject({
      subtotal: 5000,
      discountValue: 8000,
      discountAmount: 5000,
      total: 0,
      changeGiven: 0,
    });
  });

  it("returns the same bill for the same Idempotency-Key (double Enter, retry)", async () => {
    const water = await newProduct("ITORD-1", 700, 10);
    const key = randomUUID();
    const body = {
      items: [{ productId: water.id, qty: 1 }],
      payment: { method: "CASH", cashReceived: 1000 },
    };

    const [a, b] = await Promise.all([sale(body, key), sale(body, key)]);
    const c = await sale(body, key);

    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(new Set([a.body.order.id, b.body.order.id, c.body.order.id]).size).toBe(1);
    expect(c.status).toBe(200);
    expect(await stockOf(water.id)).toBe(9); // cut once
    expect(await prisma.order.count({ where: { terminalId } })).toBe(1);
  });

  it("saves nothing when the cash is short, an item is turned off, or the key is missing", async () => {
    const water = await newProduct("ITORD-1", 700, 10);

    const short = await sale({
      items: [{ productId: water.id, qty: 2 }],
      payment: { method: "CASH", cashReceived: 1000 },
    });
    expect(short.status).toBe(400);
    expect(short.body.error.message).toBe("Not enough cash: short by 4.00 ฿.");

    await post(`/products/${water.id}/deactivate`, {});
    const off = await sale({
      items: [{ productId: water.id, qty: 1 }],
      payment: { method: "CASH", cashReceived: 1000 },
    });
    expect(off.status).toBe(409);
    expect(off.body.error.message).toBe("Item ITORD-1 is turned off. Take it off the bill.");

    const noKey = await request(app)
      .post("/orders")
      .set(headers)
      .send({
        terminalId,
        items: [{ productId: water.id, qty: 1 }],
        discount: null,
        payment: { method: "CASH", cashReceived: 1000 },
        clientCreatedAt: new Date().toISOString(),
      });
    expect(noKey.status).toBe(400);

    expect(await stockOf(water.id)).toBe(10);
    expect(await prisma.order.count({ where: { terminalId } })).toBe(0);
    // The failed attempts didn't use up bill numbers
    expect(
      (await prisma.terminal.findUniqueOrThrow({ where: { id: terminalId } })).lastBillSeq,
    ).toBe(0);
  });

  it("saves a PromptPay sale as pending, with no cash", async () => {
    const water = await newProduct("ITORD-1", 700, 10);
    const res = await sale({
      items: [{ productId: water.id, qty: 2 }],
      payment: { method: "PROMPTPAY" },
    });
    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({
      paymentMethod: "PROMPTPAY",
      total: 1400,
      cashReceived: null,
      changeGiven: null,
      promptpay: { status: "PENDING", receivedAt: null, receivedBy: null },
      customer: null,
    });
    expect(await stockOf(water.id)).toBe(8); // goods left the store: stock is cut now
  });

  it("puts a sale on credit: new customer by name, then the same customer again", async () => {
    const water = await newProduct("ITORD-1", 2500, 10);

    const first = await sale({
      items: [{ productId: water.id, qty: 2 }],
      payment: { method: "CREDIT", customer: { newName: "  itest   Somchai " } },
    });
    expect(first.status).toBe(201);
    expect(first.body.order.customer).toMatchObject({ name: "itest Somchai" });
    expect(first.body.customerBalance).toBe(5000);

    // Same name with different case/spaces → same customer, balance adds up
    const second = await sale({
      items: [{ productId: water.id, qty: 1 }],
      payment: { method: "CREDIT", customer: { newName: "ITEST somchai" } },
    });
    expect(second.body.order.customer.id).toBe(first.body.order.customer.id);
    expect(second.body.customerBalance).toBe(7500);

    const byId = await sale({
      items: [{ productId: water.id, qty: 1 }],
      payment: { method: "CREDIT", customer: { id: first.body.order.customer.id } },
    });
    expect(byId.body.customerBalance).toBe(10000);

    const entries = await prisma.creditEntry.findMany({
      where: { customerId: first.body.order.customer.id },
    });
    expect(entries.map((e) => [e.type, e.amount]).sort()).toEqual([
      ["CHARGE", 2500],
      ["CHARGE", 2500],
      ["CHARGE", 5000],
    ]);
    const audit = await prisma.auditLog.findMany({
      where: {
        action: { in: ["CUSTOMER_CREATE", "CREDIT_CHARGE"] },
        userName: `${USER_PREFIX}nok`,
      },
      orderBy: { createdAt: "asc" },
    });
    expect(audit.map((a) => a.action)).toEqual([
      "CUSTOMER_CREATE",
      "CREDIT_CHARGE",
      "CREDIT_CHARGE",
      "CREDIT_CHARGE",
    ]);
    expect(audit[1]?.after).toMatchObject({ amount: 5000, balanceBefore: 0, balanceAfter: 5000 });

    const search = await request(app)
      .get("/credit/customers")
      .query({ search: "ITEST SOMCH" })
      .set(headers);
    expect(search.body.items).toEqual([
      expect.objectContaining({ name: "itest Somchai", balance: 10000 }),
    ]);
  });

  it("refuses credit for a free bill", async () => {
    const water = await newProduct("ITORD-1", 500, 10);
    const res = await sale({
      items: [{ productId: water.id, qty: 1 }],
      discount: { type: "FIXED", value: 500 },
      payment: { method: "CREDIT", customer: { newName: "itest Free" } },
    });
    expect(res.status).toBe(400);
    expect(await prisma.customer.count({ where: { nameKey: "itest free" } })).toBe(0);
  });

  it("lists active terminals", async () => {
    const res = await request(app).get("/terminals").set(headers);
    expect(res.body.items.map((t: { code: string }) => t.code)).toContain("ITX");
  });
});
