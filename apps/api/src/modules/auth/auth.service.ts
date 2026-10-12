import type { AuthUser } from "@pos/shared";
import { writeAudit, type AuditActor } from "../../audit/audit";
import { AUTH, DAY_MS } from "../../config";
import type { User } from "../../generated/prisma/client";
import { HttpError } from "../../lib/http-error";
import { prisma } from "../../lib/prisma";
import type { RequestMeta } from "../../lib/request-meta";
import { verifyPassword } from "./password";
import { hashRefreshToken, newRefreshToken, signAccessToken } from "./tokens";

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

const sessionEnded = () =>
  HttpError.unauthorized("Your session has ended. Please log in again.", "SESSION_EXPIRED");

export function toAuthUser(user: Pick<User, "id" | "username" | "displayName" | "role">): AuthUser {
  return { id: user.id, username: user.username, displayName: user.displayName, role: user.role };
}

function actorOf(user: Pick<User, "id" | "displayName" | "role">): AuditActor {
  return { userId: user.id, userName: user.displayName, role: user.role };
}

function refreshExpiry(from = new Date()) {
  return new Date(from.getTime() + AUTH.refreshTtlDays * DAY_MS);
}

async function issueAccessToken(user: User) {
  return signAccessToken({ userId: user.id, role: user.role, displayName: user.displayName });
}

/** Check username + password and start a new session. */
export async function login(
  input: { username: string; password: string },
  meta: RequestMeta,
): Promise<SessionTokens> {
  const user = await prisma.user.findUnique({ where: { username: input.username } });
  const passwordOk = await verifyPassword(input.password, user?.passwordHash);

  if (!user || !passwordOk) {
    await writeAudit(
      prisma,
      user ? actorOf(user) : { userId: null, userName: input.username, role: "UNKNOWN" },
      {
        action: "LOGIN_FAILED",
        entityType: "User",
        entityId: user?.id,
        after: { username: input.username },
      },
      meta,
    );
    throw HttpError.unauthorized("Wrong username or password.", "INVALID_CREDENTIALS");
  }

  // Only reveal "turned off" after the right password, so it can't be used to probe usernames.
  if (!user.isActive) {
    await writeAudit(
      prisma,
      actorOf(user),
      {
        action: "LOGIN_FAILED",
        entityType: "User",
        entityId: user.id,
        reason: "Account turned off",
      },
      meta,
    );
    throw HttpError.forbidden("This account is turned off. Ask the admin.", "ACCOUNT_DISABLED");
  }

  const refreshToken = newRefreshToken();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Housekeeping: drop this user's old sessions so the table stays small.
    await tx.session.deleteMany({
      where: { userId: user.id, OR: [{ expiresAt: { lt: now } }, { revokedAt: { not: null } }] },
    });
    await tx.session.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: refreshExpiry(now),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });
    await writeAudit(
      tx,
      actorOf(user),
      { action: "LOGIN", entityType: "User", entityId: user.id },
      meta,
    );
  });

  return { accessToken: await issueAccessToken(user), refreshToken, user: toAuthUser(user) };
}

/** Swap a valid refresh token for a new access token and a new (rotated) refresh token. */
export async function refresh(
  refreshToken: string | undefined,
  meta: RequestMeta,
): Promise<SessionTokens> {
  if (!refreshToken) throw sessionEnded();

  const oldHash = hashRefreshToken(refreshToken);
  const now = new Date();
  const session = await prisma.session.findUnique({
    where: { tokenHash: oldHash },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt <= now || !session.user.isActive) {
    throw sessionEnded();
  }

  const nextToken = newRefreshToken();
  // Rotate only if nobody rotated it in the meantime (two requests racing with the same token).
  const { count } = await prisma.session.updateMany({
    where: { id: session.id, tokenHash: oldHash, revokedAt: null },
    data: {
      tokenHash: hashRefreshToken(nextToken),
      expiresAt: refreshExpiry(now),
      lastUsedAt: now,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });
  if (count !== 1) throw sessionEnded();

  return {
    accessToken: await issueAccessToken(session.user),
    refreshToken: nextToken,
    user: toAuthUser(session.user),
  };
}

/** End the session behind this refresh token (if any). Always succeeds. */
export async function logout(refreshToken: string | undefined, meta: RequestMeta): Promise<void> {
  if (!refreshToken) return;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashRefreshToken(refreshToken) },
    include: { user: true },
  });
  if (!session || session.revokedAt) return;

  await prisma.$transaction(async (tx) => {
    await tx.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    await writeAudit(
      tx,
      actorOf(session.user),
      { action: "LOGOUT", entityType: "User", entityId: session.userId },
      meta,
    );
  });
}

/** The current user, fresh from the database (role or active status may have changed). */
export async function currentUser(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) throw sessionEnded();
  return toAuthUser(user);
}
