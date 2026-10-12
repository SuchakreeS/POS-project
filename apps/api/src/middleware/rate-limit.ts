import type { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { HttpError } from "../lib/http-error";

/** Max 10 failed logins per IP + username in 15 minutes. Successful logins don't count. */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const username =
      typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
    return `${ipKeyGenerator(req.ip ?? "unknown")}:${username}`;
  },
  handler: (_req, _res, next) => {
    next(
      new HttpError(
        429,
        "TOO_MANY_REQUESTS",
        "Too many login attempts. Wait 15 minutes and try again.",
      ),
    );
  },
});
