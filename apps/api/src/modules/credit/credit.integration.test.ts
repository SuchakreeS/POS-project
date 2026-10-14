/**
 * Credit page API against a real database (needs TEST_DATABASE_URL, see README).
 * Uses terminal "ITC", product "ITCR-1", customers named "itcr …" and users "itestcr_…".
 */
import type { CreditBoard, CustomerDetail } from "@pos/shared";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { createTestUser, dbTestsEnabled, deleteTestUsers } from "../../test/db-helpers";

const app = createApp();
const USER_PREFIX = "itestcr_";
let headers: Record<string, string>;
let terminalId: string;
let productId: string;

async function cleanup() {
  const customers = await prisma.customer.findMany({ where: { nameKey: { startsWith: "itcr " } } });
  const customerIds = customers.map((c) => c.id);
  const entries = await prisma.creditEntry.findMany({ where: { customerId: { in: customerIds } } });
  const orders = await prisma.order.findMany({ where: { terminalId } });
  const orderIds = orders.map((o) => o.id);
  await prisma.auditLog.deleteMany({
    where: { entityId: { in: [...customerIds, ...entries.map((e) => e.id), ...orderIds] } },
  });
  await prisma.creditEntry.deleteMany({ where: { customerId: { in: customerIds } } });
  await prisma.stockMovement.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
}

const post = (path: string, body: object) => request(app).post(path).set(headers).send(body);
const get = (path: string) => request(app).get(path).set(headers);

/** A credit sale of `qty` × 100.00 ฿ for a customer by name. */
async function creditSale(name: string, qty: number) {
  const res = await request(app)
    .post("/orders")
    .set(headers)
    .set("Idempotency-Key", randomUUID())
    .send({
      terminalId,
      items: [{ productId, qty }],
      discount: null,
      payment: { method: "CREDIT", customer: { newName: name } },
      clientCreatedAt: new Date().toISOString(),
    });
  expect(res.status).toBe(201);
  return res.body.order;
}

const mine = (board: CreditBoard) => board.customers.filter((c) => c.name.startsWith("itcr "));

describe.skipIf(!dbTestsEnabled)("credit API (database)", () => {
  beforeAll(async () => {
    await deleteTestUsers(USER_PREFIX);
    ({ headers } = await createTestUser(`${USER_PREFIX}nok`));
    terminalId = (
      await prisma.terminal.upsert({
        where: { code: "ITC" },
        update: {},
        create: { code: "ITC", name: "Test" },
      })
    ).id;
    productId = (
      await prisma.product.upsert({
        where: { barcode: "ITCR-1" },
        update: {},
        create: { barcode: "ITCR-1", name: "Credit item", price: 10000, stockQty: 1000 },
      })
    ).id;
  });
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.stockMovement.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.terminal.deleteMany({ where: { code: "ITC" } });
    await deleteTestUsers(USER_PREFIX);
    await prisma.$disconnect();
  });

  it("adds and edits customers, names unique ignoring case", async () => {
    const created = await post("/credit/customers", {
      name: " itcr  Somchai ",
      phone: "081-234-5678",
      note: "",
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: "itcr Somchai", phone: "081-234-5678", balance: 0 });

    const dup = await post("/credit/customers", { name: "ITCR somchai" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.issues[0].path).toEqual(["name"]);

    const edited = await request(app)
      .patch(`/credit/customers/${created.body.id}`)
      .set(headers)
      .send({ name: "itcr Somchai K", phone: "", note: "Pays on Fridays" });
    expect(edited.body).toMatchObject({ name: "itcr Somchai K", phone: null });

    const audit = await prisma.auditLog.findMany({
      where: { entityId: created.body.id },
      orderBy: { createdAt: "asc" },
    });
    expect(audit.map((a) => a.action)).toEqual(["CUSTOMER_CREATE", "CUSTOMER_UPDATE"]);
    expect(audit[1]).toMatchObject({
      before: { name: "itcr Somchai", phone: "081-234-5678", note: null },
      after: { name: "itcr Somchai K", phone: null, note: "Pays on Fridays" },
    });
  });

  it("records repayments: partial, never more than owed, logged with balance before → after", async () => {
    const bill = await creditSale("itcr Ploy", 3); // owes 300.00
    const customerId = bill.customer.id;

    const tooMuch = await post("/credit/repayments", { customerId, amount: 30001, method: "CASH" });
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.error.message).toBe("Can't be more than what they owe (300.00 ฿).");

    const paid = await post("/credit/repayments", {
      customerId,
      amount: 12000,
      method: "PROMPTPAY",
      note: "Slip checked",
    });
    expect(paid.status).toBe(201);
    expect(paid.body).toEqual({ balanceBefore: 30000, balanceAfter: 18000 });

    const rest = await post("/credit/repayments", { customerId, amount: 18000, method: "CASH" });
    expect(rest.body.balanceAfter).toBe(0);
    const nothing = await post("/credit/repayments", { customerId, amount: 100, method: "CASH" });
    expect(nothing.body.error.message).toBe("itcr Ploy doesn't owe anything right now.");

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "CREDIT_REPAYMENT", reason: "Slip checked" },
    });
    expect(audit.after).toMatchObject({
      amount: 12000,
      method: "PROMPTPAY",
      balanceBefore: 30000,
      balanceAfter: 18000,
    });
  });

  it("two payments at the same moment can't both pass the check", async () => {
    const bill = await creditSale("itcr Race", 1); // owes 100.00
    const [a, b] = await Promise.all([
      post("/credit/repayments", { customerId: bill.customer.id, amount: 10000, method: "CASH" }),
      post("/credit/repayments", { customerId: bill.customer.id, amount: 10000, method: "CASH" }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 400]);
  });

  it("shows history newest first with a running balance, and the board with stats and debt age", async () => {
    const first = await creditSale("itcr Mali", 2); // +200
    await creditSale("itcr Mali", 1); // +100 → 300
    await post("/credit/repayments", {
      customerId: first.customer.id,
      amount: 25000,
      method: "CASH",
    }); // → 50

    const detail: CustomerDetail = (await get(`/credit/customers/${first.customer.id}`)).body;
    expect(detail).toMatchObject({ name: "itcr Mali", balance: 5000, creditBillCount: 2 });
    expect(detail.history.map((h) => [h.type, h.amount, h.balanceAfter])).toEqual([
      ["REPAYMENT", -25000, 5000],
      ["CHARGE", 10000, 30000],
      ["CHARGE", 20000, 20000],
    ]);
    expect(detail.history[1]?.order?.billNo).toMatch(/^ITC-\d{6}$/);
    expect(detail.history[0]).toMatchObject({ method: "CASH", userName: `${USER_PREFIX}nok` });
    // 250 paid the first bill (200) and 50 of the second → the second bill is the oldest unpaid
    expect(detail.oldestUnpaidAt).toBe(detail.history[1]?.createdAt);

    const board: CreditBoard = (await get("/credit")).body;
    expect(mine(board)).toEqual([expect.objectContaining({ name: "itcr Mali", balance: 5000 })]);
    expect(board.stats.totalOwed).toBeGreaterThanOrEqual(5000);
    expect(board.stats.collectedToday).toBeGreaterThanOrEqual(25000);
    expect(board.stats.collectedTodayCount).toBeGreaterThanOrEqual(1);
  });
});
