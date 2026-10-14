import type { Role } from "@pos/shared";
import type { Request, RequestHandler } from "express";
import { HttpError } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import { verifyAccessToken } from "../modules/auth/tokens";

/** Requires a valid `Authorization: Bearer <access token>` and sets `req.auth`. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : undefined;
  if (!token) throw HttpError.unauthorized();

  try {
    req.auth = await verifyAccessToken(token);
  } catch {
    throw HttpError.sessionEnded();
  }
  next();
};

/**
 * Use after requireAuth: allows only the given roles (403 otherwise).
 * The role inside the token can be up to 15 minutes old, so it is checked again in the database:
 * an admin who was demoted or turned off loses admin pages at once, not at their next refresh.
 */
export function requireRole(...roles: Role[]): RequestHandler {
  return async (req, _res, next) => {
    const auth = getAuth(req);
    if (!roles.includes(auth.role)) throw HttpError.forbidden();

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { role: true, isActive: true },
    });
    if (!user?.isActive) throw HttpError.sessionEnded();
    if (!roles.includes(user.role)) throw HttpError.forbidden();
    next();
  };
}

/** The caller, inside a route that uses requireAuth. */
export function getAuth(req: Request): NonNullable<Request["auth"]> {
  if (!req.auth) throw HttpError.unauthorized();
  return req.auth;
}
