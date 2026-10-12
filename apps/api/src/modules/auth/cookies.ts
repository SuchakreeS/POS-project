import type { CookieOptions, Request, Response } from "express";
import { AUTH, DAY_MS } from "../../config";
import { env } from "../../env";

/**
 * Production: web (Vercel) and API (Render) are on different sites → SameSite=None; Secure.
 * Development: both on localhost (same site) → SameSite=Lax over plain http.
 */
export function refreshCookieOptions(): CookieOptions {
  const production = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? "none" : "lax",
    path: AUTH.refreshCookiePath,
  };
}

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(AUTH.refreshCookieName, token, {
    ...refreshCookieOptions(),
    maxAge: AUTH.refreshTtlDays * DAY_MS,
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(AUTH.refreshCookieName, refreshCookieOptions());
}

export function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[AUTH.refreshCookieName];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
