/**
 * Orders page API (history, bill detail, void) against a real database (needs TEST_DATABASE_URL).
 * Uses terminal "ITV", products "ITVOID-…", customers "itvoid …" and users "itestvoid_…".
 * Lists are searched by "ITV-" so bills made by other test files at the same time don't count.
 */
import type { Order, OrderPage } from "@pos/shared";
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
const USER_PREFIX = "itestvoid_";
let headers: Record<string, string>;
let terminalId: string;
let water: string; // 10.00 ฿
let rice: string; // 50.00 ฿

async function cleanup() {
  await deleteTerminalOrders(terminalId);
  await deleteTestCustomers("itvoid ");
}

const post = (path: string, body: object) => request(app).post(path).set(headers).send(body);
const get = (path: string) => request(app).get(path).set(headers);
const list = async (params: Record<string, string> = {}): Promise<OrderPage> => {
  const res = await get(`/orders?${new URLSearchParams({ search: "ITV-", ...params })}`);
  expect(res.status).toBe(200);
  return res.body;
};
const stockOf = async (id: string) =>
  (await prisma.product.findUniqueOrThrow({ where: { id } })).stockQty;

async function sale(payment: object, items = [{ productId: water, qty: 2 }]): Promise<Order> {
  const res = await request(app)
    .post("/orders")
    .set(headers)
    .set("Idempotency-Key", randomUUID())
    .send({
      terminalId,
      items,
      discount: null,
      payment,
      clientCreatedAt: new Date().toISOString(),
    });
  expect(res.status).toBe(201);
  return res.body.order;
}

describe.skipIf(!dbTestsEnabled)("orders history + void API (database)", () => {
  beforeAll(async () => {
    await deleteTestUsers(USER_PREFIX);
    ({ headers } = await createTestUser(`${USER_PREFIX}nok`));
    terminalId = (
      await prisma.terminal.upsert({
        where: { code: "ITV" },
        update: {},
        create: { code: "ITV", name: "Test" },
      })
    ).id;
    const product = (barcode: string, name: string, price: number) =>
      prisma.product.upsert({
        where: { barcode },
        update: {},
        create: { barcode, name, price, stockQty: 1000 },
      });
    water = (await product("ITVOID-1", "Void water", 1000)).id;
    rice = (await product("ITVOID-2", "Void rice", 5000)).id;
  });
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.stockMovement.deleteMany({ where: { productId: { in: [water, rice] } } });
    await prisma.product.deleteMany({ where: { id: { in: [water, rice] } } });
    await prisma.terminal.deleteMany({ where: { code: "ITV" } });
    await deleteTestUsers(USER_PREFIX);
    await prisma.$disconnect();
  });

  it("lists bills newest first with filters, search, stats and paging", async () => {
    const cash = await sale({ method: "CASH", cashReceived: 2000 });
    const pp = await sale({ method: "PROMPTPAY" }, [
      { productId: water, qty: 1 },
      { productId: rice, qty: 3 },
    ]);
    const credit = await sale({ method: "CREDIT", customer: { newName: "itvoid Mali" } });

    const all = await list();
    expect(all.items.map((o) => o.billNo)).toEqual([credit.billNo, pp.billNo, cash.billNo]);
    expect(all.items[1]).toMatchObject({
      paymentMethod: "PROMPTPAY",
      promptpayStatus: "PENDING",
      lineCount: 2,
      pieceCount: 4,
      total: 16000,
    });
    expect(all.items[0]?.customerName).toBe("itvoid Mali");
    expect(all.stats.CASH).toMatchObject({ bills: 1, sales: 2000 });
    expect(all.stats.PROMPTPAY).toMatchObject({ bills: 1, sales: 16000, promptpayPending: 1 });

    expect((await list({ filter: "CASH" })).items.map((o) => o.id)).toEqual([cash.id]);
    // Customer name search finds the credit bill even though "ITV-" isn't in the name.
    const byName = await get(`/orders?search=${encodeURIComponent("VOID mal")}`);
    expect(byName.body.items.map((o: Order) => o.id)).toEqual([credit.id]);

    const first = await list({ limit: "2" });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = await list({ limit: "2", cursor: first.nextCursor ?? "" });
    expect(second.items.map((o) => o.id)).toEqual([cash.id]);
    expect(second.nextCursor).toBeNull();

    // Another day has none of them.
    expect((await list({ from: "2026-01-01", to: "2026-01-01" })).items).toEqual([]);
    expect((await get("/orders?from=2026-01-02&to=2026-01-01")).status).toBe(400);
  });

  it("shows a bill, and 404 for one that doesn't exist", async () => {
    const cash = await sale({ method: "CASH", cashReceived: 5000 });
    const res = await get(`/orders/${cash.id}`);
    expect(res.body).toMatchObject({
      billNo: cash.billNo,
      status: "COMPLETED",
      cashReceived: 5000,
      changeGiven: 3000,
      voided: null,
      items: [{ productName: "Void water", qty: 2, unitPrice: 1000, lineTotal: 2000 }],
    });
    expect((await get(`/orders/${randomUUID()}`)).status).toBe(404);
  });

  it("voids a bill: stock back, VOID_RETURN movements, audit, not in sales, only once", async () => {
    const bill = await sale({ method: "CASH", cashReceived: 20000 }, [
      { productId: water, qty: 2 },
      { productId: rice, qty: 3 },
    ]);
    const [waterBefore, riceBefore] = [await stockOf(water), await stockOf(rice)];

    expect((await post(`/orders/${bill.id}/void`, { reason: "Other" })).status).toBe(400);
    const res = await post(`/orders/${bill.id}/void`, {
      reason: "Wrong items",
      note: "Rang up rice instead of noodles",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "VOIDED",
      voided: {
        by: `${USER_PREFIX}nok`,
        reason: "Wrong items",
        note: "Rang up rice instead of noodles",
      },
    });
    expect(await stockOf(water)).toBe(waterBefore + 2);
    expect(await stockOf(rice)).toBe(riceBefore + 3);

    const movements = await prisma.stockMovement.findMany({
      where: { orderId: bill.id, type: "VOID_RETURN" },
    });
    expect(movements.map((m) => m.qty).sort()).toEqual([2, 3]);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: bill.id, action: "ORDER_VOID" },
    });
    expect(audit.reason).toBe("Wrong items");
    expect(audit.after).toMatchObject({ billNo: bill.billNo, total: 17000, itemCount: 5 });

    const again = await post(`/orders/${bill.id}/void`, { reason: "Duplicate bill" });
    expect(again.status).toBe(409);
    expect(await stockOf(water)).toBe(waterBefore + 2); // nothing returned twice

    const page = await list();
    expect(page.items[0]).toMatchObject({ id: bill.id, status: "VOIDED" });
    expect(page.stats.CASH).toMatchObject({ bills: 0, sales: 0, voided: 1, voidedTotal: 17000 });
    expect((await list({ filter: "VOIDED" })).items.map((o) => o.id)).toEqual([bill.id]);
  });

  it("two voids at the same moment: one wins, stock comes back once", async () => {
    const bill = await sale({ method: "CASH", cashReceived: 2000 });
    const before = await stockOf(water);
    const results = await Promise.all([
      post(`/orders/${bill.id}/void`, { reason: "Duplicate bill" }),
      post(`/orders/${bill.id}/void`, { reason: "Duplicate bill" }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await stockOf(water)).toBe(before + 2);
  });

  it("voiding a credit bill adds CHARGE_VOID (not money received); balance can go below 0", async () => {
    const bill = await sale({ method: "CREDIT", customer: { newName: "itvoid Somchai" } }, [
      { productId: rice, qty: 2 },
    ]); // owes 100.00
    const customerId = bill.customer?.id ?? "";
    await post("/credit/repayments", { customerId, amount: 3000, method: "CASH" }); // owes 70.00
    const collected = async () => (await get("/credit")).body.stats.collectedToday as number;
    const collectedBefore = await collected();

    const res = await post(`/orders/${bill.id}/void`, { reason: "Customer changed mind" });
    expect(res.status).toBe(200);

    const detail = await get(`/credit/customers/${customerId}`);
    expect(detail.body.balance).toBe(-3000); // the shop owes them 30.00
    expect(detail.body.history[0]).toMatchObject({
      type: "CHARGE_VOID",
      amount: -10000,
      order: { id: bill.id, billNo: bill.billNo },
      balanceAfter: -3000,
    });

    const entry = await prisma.creditEntry.findFirstOrThrow({
      where: { orderId: bill.id, type: "CHARGE_VOID" },
    });
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: entry.id, action: "CREDIT_CHARGE_VOID" },
    });
    expect(audit.after).toMatchObject({ balanceBefore: 7000, balanceAfter: -3000, amount: 10000 });
    expect(await collected()).toBe(collectedBefore); // a void is never money received
  });

  it("a voided PromptPay bill leaves the check page and can't be marked received", async () => {
    const bill = await sale({ method: "PROMPTPAY" });
    await post(`/orders/${bill.id}/void`, { reason: "Payment not received" });

    const board = await get("/promptpay");
    expect(board.body.pending.map((b: { orderId: string }) => b.orderId)).not.toContain(bill.id);
    const received = await post("/promptpay/receive", { orderIds: [bill.id] });
    expect(received.body.items).toEqual([]);
    expect((await get(`/orders/${bill.id}`)).body.promptpay.status).toBe("PENDING");
  });
});
