import type { Role } from "@pos/shared";
import type { Request, RequestHandler } from "express";
import { HttpError } from "../lib/http-error";
import { verifyAccessToken } from "../modules/auth/tokens";

/** Requires a valid `Authorization: Bearer <access token>` and sets `req.auth`. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : undefined;
  if (!token) throw HttpError.unauthorized();

  try {
    req.auth = await verifyAccessToken(token);
  } catch {
    throw HttpError.unauthorized("Your session has ended. Please log in again.", "SESSION_EXPIRED");
  }
  next();
};

/** Use after requireAuth: allows only the given roles (403 otherwise). */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) throw HttpError.unauthorized();
    if (!roles.includes(req.auth.role)) throw HttpError.forbidden();
    next();
  };
}

/** The caller, inside a route that uses requireAuth. */
export function getAuth(req: Request): NonNullable<Request["auth"]> {
  if (!req.auth) throw HttpError.unauthorized();
  return req.auth;
}
