import type {
  ManagedUser,
  passwordResetSchema,
  userCreateSchema,
  userUpdateSchema,
} from "@pos/shared";
import type { z } from "zod";
import { writeAudit, type AuditContext } from "../../audit/audit";
import type { User } from "../../generated/prisma/client";
import type { Db } from "../../lib/db";
import { HttpError } from "../../lib/http-error";
import { prisma } from "../../lib/prisma";
import { isUniqueViolation } from "../../lib/prisma-errors";
import type { RequestContext } from "../../lib/request-context";
import { hashPassword } from "../auth/password";

/*
 * Users (plan.md → Users page). Used by the admin-only /users routes and by the
 * `pnpm user:*` terminal commands, so both follow the same rules and write the same audit entries.
 * Users are never deleted: sales, voids and the audit log point to them.
 */

export type UserCreateInput = z.output<typeof userCreateSchema>;
export type UserUpdateInput = z.output<typeof userUpdateSchema>;
export type PasswordResetInput = z.output<typeof passwordResetSchema>;

export function toManagedUser(user: User): ManagedUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

const usernameTaken = (username: string) =>
  HttpError.duplicate("username", `"${username}" is already taken. Pick another username.`);
const userGone = () => HttpError.notFound("This user doesn't exist.");
const LAST_ADMIN = "The shop needs at least one active admin. Make someone else an admin first.";

/** Active users first, admins before cashiers, then by name. */
export async function listUsers(): Promise<ManagedUser[]> {
  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { displayName: "asc" }],
  });
  return users.map(toManagedUser);
}

export async function findByUsername(username: string): Promise<ManagedUser | null> {
  const user = await prisma.user.findUnique({ where: { username } });
  return user ? toManagedUser(user) : null;
}

export async function createUser(input: UserCreateInput, ctx: AuditContext): Promise<ManagedUser> {
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: input.username,
          displayName: input.displayName,
          role: input.role,
          passwordHash,
        },
      });
      await writeAudit(
        tx,
        ctx.actor,
        {
          action: "USER_CREATE",
          entityType: "User",
          entityId: user.id,
          after: { username: user.username, displayName: user.displayName, role: user.role },
        },
        ctx.meta,
      );
      return toManagedUser(user);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw usernameTaken(input.username);
    throw error;
  }
}

/**
 * Edit name, username and role. Admins can't take away their own Admin role, and there is
 * always at least one active admin left.
 */
export async function updateUser(
  id: string,
  input: UserUpdateInput,
  ctx: RequestContext,
): Promise<ManagedUser> {
  try {
    return await prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({ where: { id } });
      if (!before) throw userGone();

      const demoted = before.role === "ADMIN" && input.role !== "ADMIN";
      if (demoted) {
        if (id === ctx.actor.userId) {
          throw roleError("You can't remove your own Admin role. Ask another admin to do it.");
        }
        if (before.isActive && !(await hasAnotherActiveAdmin(tx, id))) {
          throw roleError(LAST_ADMIN);
        }
      }

      const user = await tx.user.update({ where: { id }, data: input });

      const changed = (["displayName", "username"] as const).filter(
        (field) => before[field] !== user[field],
      );
      if (changed.length > 0) {
        await writeAudit(
          tx,
          ctx.actor,
          {
            action: "USER_UPDATE",
            entityType: "User",
            entityId: id,
            before: Object.fromEntries(changed.map((field) => [field, before[field]])),
            after: Object.fromEntries(changed.map((field) => [field, user[field]])),
          },
          ctx.meta,
        );
      }
      if (before.role !== user.role) {
        await writeAudit(
          tx,
          ctx.actor,
          {
            action: "ROLE_CHANGE",
            entityType: "User",
            entityId: id,
            before: { username: user.username, role: before.role },
            after: { username: user.username, role: user.role },
          },
          ctx.meta,
        );
      }
      return toManagedUser(user);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw usernameTaken(input.username);
    throw error;
  }
}

/**
 * Turn a user off (can't log in; logged out everywhere) or back on. Nobody can turn themselves
 * off, and the last active admin can't be turned off.
 */
export async function setUserActive(
  id: string,
  isActive: boolean,
  ctx: RequestContext,
): Promise<ManagedUser> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id } });
    if (!before) throw userGone();
    if (before.isActive === isActive) return toManagedUser(before); // already done: nothing to log

    if (!isActive) {
      if (id === ctx.actor.userId) throw HttpError.badRequest("You can't turn yourself off.");
      if (before.role === "ADMIN" && !(await hasAnotherActiveAdmin(tx, id))) {
        throw HttpError.badRequest(LAST_ADMIN);
      }
    }

    const user = await tx.user.update({ where: { id }, data: { isActive } });
    if (!isActive) await endSessions(tx, id);
    await writeAudit(
      tx,
      ctx.actor,
      {
        action: isActive ? "USER_UPDATE" : "USER_DEACTIVATE",
        entityType: "User",
        entityId: id,
        before: { username: user.username, isActive: before.isActive },
        after: { username: user.username, isActive },
      },
      ctx.meta,
    );
    return toManagedUser(user);
  });
}

/** Set a new password and log the user out on every device. The password is never logged. */
export async function resetPassword(
  id: string,
  input: PasswordResetInput,
  ctx: AuditContext,
): Promise<ManagedUser> {
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const exists = await tx.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw userGone();

    const user = await tx.user.update({ where: { id }, data: { passwordHash } });
    await endSessions(tx, id);
    await writeAudit(
      tx,
      ctx.actor,
      {
        action: "USER_UPDATE",
        entityType: "User",
        entityId: id,
        after: { username: user.username, passwordReset: true },
      },
      ctx.meta,
    );
    return toManagedUser(user);
  });
}

// ---------- Helpers ----------

function roleError(message: string) {
  return new HttpError(400, "VALIDATION", message, [{ path: ["role"], message }]);
}

/**
 * Is there an active admin other than `userId`? The active admins are locked, so two admins
 * demoting or turning off each other at the same moment can't both succeed.
 */
async function hasAnotherActiveAdmin(tx: Db, userId: string): Promise<boolean> {
  const admins = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE role = 'ADMIN' AND "isActive" = true FOR UPDATE`;
  return admins.some((admin) => admin.id !== userId);
}

/** Revoke every open session: the user can't refresh, so they're out within 15 minutes everywhere. */
async function endSessions(tx: Db, userId: string) {
  await tx.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
