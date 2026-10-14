/**
 * PromptPay check page API against a real database (needs TEST_DATABASE_URL, see README).
 * Uses its own terminal "ITP", products "ITPP-…" and users "itestpp_…".
 */
import type { PromptPayBoard } from "@pos/shared";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import {
  createTestUser,
  dbTestsEnabled,
  deleteTerminalOrders,
  deleteTestUsers,
} from "../../test/db-helpers";

const app = createApp();
const USER_PREFIX = "itestpp_";
let headers: Record<string, string>;
let terminalId: string;
let productId: string;

const cleanup = () => deleteTerminalOrders(terminalId);

const post = (path: string, body: object) => request(app).post(path).set(headers).send(body);
const board = async (): Promise<PromptPayBoard> =>
  (await request(app).get("/promptpay").set(headers)).body;
const mine = (b: PromptPayBoard) => ({
  pending: b.pending.filter((bill) => bill.billNo.startsWith("ITP-")),
  received: b.receivedToday.filter((bill) => bill.billNo.startsWith("ITP-")),
});

async function promptpaySale(qty: number) {
  const res = await request(app)
    .post("/orders")
    .set(headers)
    .set("Idempotency-Key", randomUUID())
    .send({
      terminalId,
      items: [{ productId, qty }],
      discount: null,
      payment: { method: "PROMPTPAY" },
      clientCreatedAt: new Date().toISOString(),
    });
  expect(res.status).toBe(201);
  return res.body.order;
}

describe.skipIf(!dbTestsEnabled)("PromptPay API (database)", () => {
  beforeAll(async () => {
    await deleteTestUsers(USER_PREFIX);
    ({ headers } = await createTestUser(`${USER_PREFIX}nok`));
    terminalId = (
      await prisma.terminal.upsert({
        where: { code: "ITP" },
        update: {},
        create: { code: "ITP", name: "Test" },
      })
    ).id;
    const product = await prisma.product.upsert({
      where: { barcode: "ITPP-1" },
      update: {},
      create: { barcode: "ITPP-1", name: "PP item", price: 4500, stockQty: 1000 },
    });
    productId = product.id;
  });
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.stockMovement.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.terminal.deleteMany({ where: { code: "ITP" } });
    await deleteTestUsers(USER_PREFIX);
    await prisma.$disconnect();
  });

  it("lists pending bills oldest first, marks them received (bulk, twice is harmless) and counts", async () => {
    const a = await promptpaySale(1);
    const b = await promptpaySale(2);
    const c = await promptpaySale(3);

    const before = mine(await board());
    expect(before.pending.map((bill) => bill.billNo)).toEqual([a.billNo, b.billNo, c.billNo]);
    expect(before.pending[0]).toMatchObject({
      total: 4500,
      cashierName: `${USER_PREFIX}nok`,
      status: "PENDING",
    });

    const res = await post("/promptpay/receive", { orderIds: [a.id, b.id, a.id] });
    expect(res.body.items.map((bill: { billNo: string }) => bill.billNo).sort()).toEqual(
      [a.billNo, b.billNo].sort(),
    );
    const again = await post("/promptpay/receive", { orderIds: [a.id] });
    expect(again.body.items).toEqual([]);

    const after = mine(await board());
    expect(after.pending.map((bill) => bill.billNo)).toEqual([c.billNo]);
    expect(after.received.map((bill) => bill.billNo)).toEqual([a.billNo, b.billNo]);
    expect(after.received[0]).toMatchObject({
      status: "RECEIVED",
      receivedBy: `${USER_PREFIX}nok`,
    });

    const audit = await prisma.auditLog.findMany({
      where: { action: "PROMPTPAY_RECEIVED", entityId: { in: [a.id, b.id] } },
    });
    expect(audit).toHaveLength(2);

    const summary = await request(app).get("/promptpay/summary").set(headers);
    expect(summary.body.pendingCount).toBeGreaterThanOrEqual(1);
  });

  it("undoes a received bill only with a reason, and only if it was received", async () => {
    const a = await promptpaySale(1);
    await post("/promptpay/receive", { orderIds: [a.id] });

    const noReason = await post(`/promptpay/${a.id}/undo`, { reason: " " });
    expect(noReason.status).toBe(400);
    expect(noReason.body.error.message).toBe("Say why it wasn't received");

    const undo = await post(`/promptpay/${a.id}/undo`, {
      reason: "Wrong bill — it was the 45 baht at 14:02",
    });
    expect(undo.body).toMatchObject({ status: "PENDING", receivedAt: null, receivedBy: null });

    const twice = await post(`/promptpay/${a.id}/undo`, { reason: "again" });
    expect(twice.status).toBe(409);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "PROMPTPAY_RECEIVED_UNDO", entityId: a.id },
    });
    expect(audit.reason).toBe("Wrong bill — it was the 45 baht at 14:02");
    expect(audit.before).toMatchObject({ billNo: a.billNo, receivedBy: `${USER_PREFIX}nok` });
  });

  it("drops voided bills from the list and won't receive them", async () => {
    const a = await promptpaySale(1);
    await prisma.order.update({ where: { id: a.id }, data: { status: "VOIDED" } }); // void comes in step 9
    expect(mine(await board()).pending).toEqual([]);
    const res = await post("/promptpay/receive", { orderIds: [a.id] });
    expect(res.body.items).toEqual([]);
  });
});
