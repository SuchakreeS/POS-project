import type { AuthUser, Role } from "@pos/shared";
import { writeAudit, type AuditActor } from "../../audit/audit";
import { HttpError } from "../../lib/http-error";
import { prisma } from "../../lib/prisma";
import type { RequestMeta } from "../../lib/request-meta";
import { hashPassword } from "../auth/password";
import { toAuthUser } from "../auth/auth.service";

export interface NewUser {
  username: string;
  displayName: string;
  role: Role;
  password: string;
}

/** Create a user. Inputs must already be validated (shared usernameSchema etc.). */
export async function createUser(
  input: NewUser,
  actor: AuditActor,
  meta: RequestMeta,
): Promise<AuthUser> {
  const existing = await prisma.user.findUnique({ where: { username: input.username } });
  if (existing) throw HttpError.conflict(`The username "${input.username}" is already taken.`);

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        username: input.username,
        displayName: input.displayName,
        role: input.role,
        passwordHash,
      },
    });
    await writeAudit(
      tx,
      actor,
      {
        action: "USER_CREATE",
        entityType: "User",
        entityId: created.id,
        after: { username: created.username, displayName: created.displayName, role: created.role },
      },
      meta,
    );
    return created;
  });

  return toAuthUser(user);
}

/** Set a new password and log the user out everywhere. */
export async function resetPassword(
  username: string,
  password: string,
  actor: AuditActor,
  meta: RequestMeta,
): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw HttpError.notFound(`No user named "${username}".`);

  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await tx.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await writeAudit(
      tx,
      actor,
      {
        action: "USER_UPDATE",
        entityType: "User",
        entityId: user.id,
        after: { passwordReset: true },
      },
      meta,
    );
  });

  return toAuthUser(user);
}
