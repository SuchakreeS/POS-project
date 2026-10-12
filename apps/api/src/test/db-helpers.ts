/**
 * Helpers for *.integration.test.ts files (they run only when TEST_DATABASE_URL is set).
 * Every test file uses its own prefix and removes only rows it created.
 */
import type { Role } from "@pos/shared";
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
