/**
 * Settings + terminals API against a real database (needs TEST_DATABASE_URL, see README).
 * Uses users "itestset_…" and terminal "ITS". The settings row is put back as it was afterwards.
 */
import type { ShopSettings } from "@pos/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { createTestUser, dbTestsEnabled, deleteTestUsers } from "../../test/db-helpers";

const app = createApp();
const PREFIX = "itestset_";
let adminHeaders: Record<string, string>;
let cashierHeaders: Record<string, string>;
let original: ShopSettings;

const form: ShopSettings = {
  shopName: "Test Mini Mart",
  shopPhone: "02-123-4567",
  reportTime: "21:30",
  sendReportToLine: false,
  defaultLowStockAt: 3,
};

async function cleanupTerminal() {
  const terminal = await prisma.terminal.findUnique({ where: { code: "ITS" } });
  if (!terminal) return;
  await prisma.auditLog.deleteMany({ where: { entityId: terminal.id } });
  await prisma.terminal.delete({ where: { id: terminal.id } });
}

describe.skipIf(!dbTestsEnabled)("settings + terminals API (database)", () => {
  beforeAll(async () => {
    await deleteTestUsers(PREFIX);
    await cleanupTerminal();
    ({ headers: adminHeaders } = await createTestUser(`${PREFIX}boss`, "ADMIN"));
    ({ headers: cashierHeaders } = await createTestUser(`${PREFIX}cash`, "CASHIER"));
    original = (await request(app).get("/settings").set(adminHeaders)).body;
  });
  afterAll(async () => {
    await request(app).patch("/settings").set(adminHeaders).send(original);
    await cleanupTerminal();
    await deleteTestUsers(PREFIX);
    await prisma.$disconnect();
  });

  it("everyone reads settings; only admins save, and only changes are logged", async () => {
    expect((await request(app).get("/settings").set(cashierHeaders)).status).toBe(200);
    expect((await request(app).patch("/settings").set(cashierHeaders).send(form)).status).toBe(403);

    // Start from known values, then change two fields.
    await request(app).patch("/settings").set(adminHeaders).send(form);
    const since = new Date();
    const res = await request(app)
      .patch("/settings")
      .set(adminHeaders)
      .send({ ...form, reportTime: "22:15", shopPhone: "" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ...form, reportTime: "22:15", shopPhone: null });

    const audits = await prisma.auditLog.findMany({
      where: { action: "SETTINGS_UPDATE", createdAt: { gte: since } },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      before: { reportTime: "21:30", shopPhone: "02-123-4567" },
      after: { reportTime: "22:15", shopPhone: null },
    });

    // Saving the same values again writes nothing.
    await request(app)
      .patch("/settings")
      .set(adminHeaders)
      .send({ ...form, reportTime: "22:15", shopPhone: "" });
    expect(
      await prisma.auditLog.count({
        where: { action: "SETTINGS_UPDATE", createdAt: { gte: since } },
      }),
    ).toBe(1);

    const bad = await request(app)
      .patch("/settings")
      .set(adminHeaders)
      .send({ ...form, reportTime: "25:00" });
    expect(bad.status).toBe(400);
    expect(bad.body.error.issues[0].path).toEqual(["reportTime"]);
  });

  it("lists terminals with their next bill number; admins add new ones (unique code)", async () => {
    expect(
      (await request(app).post("/terminals").set(cashierHeaders).send({ code: "ITS", name: "x" }))
        .status,
    ).toBe(403);

    const created = await request(app)
      .post("/terminals")
      .set(adminHeaders)
      .send({ code: " its ", name: "Integration counter" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      code: "ITS",
      name: "Integration counter",
      nextBillNo: "ITS-000001",
    });

    const dup = await request(app)
      .post("/terminals")
      .set(adminHeaders)
      .send({ code: "ITS", name: "Again" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.issues[0].path).toEqual(["code"]);

    const list = await request(app).get("/terminals").set(cashierHeaders);
    expect(list.body.items).toContainEqual(created.body);
    expect(
      await prisma.auditLog.count({
        where: { entityId: created.body.id, action: "TERMINAL_CREATE" },
      }),
    ).toBe(1);
  });
});
