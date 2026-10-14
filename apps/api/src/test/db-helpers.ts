/**
 * Helpers for *.integration.test.ts files (they run only when TEST_DATABASE_URL is set).
 * Every test file uses its own prefix and removes only rows it created.
 */
import type { Role } from "@pos/shared";
import type { Response } from "supertest";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../modules/auth/password";
import { signAccessToken } from "../modules/auth/tokens";

export const dbTestsEnabled = Boolean(process.env.TEST_DATABASE_URL);

/** A user plus headers for an authenticated request. */
export async function createTestUser(username: string, role: Role = "CASHIER") {
  const user = await prisma.user.create({
    data: {
      username,
      displayName: username,
      role,
      passwordHash: await hashPassword("test-password-1"),
    },
  });
  const token = await signAccessToken({ userId: user.id, role, displayName: user.displayName });
  return { user, headers: { Authorization: `Bearer ${token}`, "x-pos-client": "web" } };
}

export async function deleteTestUsers(prefix: string) {
  const users = await prisma.user.findMany({
    where: { username: { startsWith: prefix } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

/** Every bill made on a test terminal: items, stock movements, credit entries and their audit rows. */
export async function deleteTerminalOrders(terminalId: string) {
  const orders = await prisma.order.findMany({ where: { terminalId }, select: { id: true } });
  const orderIds = orders.map((o) => o.id);
  const entries = await prisma.creditEntry.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const entryIds = entries.map((e) => e.id);
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...orderIds, ...entryIds] } } });
  await prisma.creditEntry.deleteMany({ where: { id: { in: entryIds } } });
  await prisma.stockMovement.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
}

/** Customers whose name starts with `prefix`, with their remaining credit entries and audit rows. */
export async function deleteTestCustomers(prefix: string) {
  const customers = await prisma.customer.findMany({
    where: { nameKey: { startsWith: prefix } },
    select: { id: true },
  });
  const customerIds = customers.map((c) => c.id);
  const entries = await prisma.creditEntry.findMany({
    where: { customerId: { in: customerIds } },
    select: { id: true },
  });
  const entryIds = entries.map((e) => e.id);
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...customerIds, ...entryIds] } } });
  await prisma.creditEntry.deleteMany({ where: { id: { in: entryIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
}

/** The `pos_refresh=…` cookie a login or refresh response set, ready for `.set("Cookie", …)`. */
export const refreshCookieOf = (res: Response) =>
  ([] as string[])
    .concat(res.headers["set-cookie"] ?? [])
    .find((cookie) => cookie.startsWith("pos_refresh="))
    ?.split(";")[0] ?? "";
