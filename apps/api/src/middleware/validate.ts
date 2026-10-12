import type { RequestHandler } from "express";
import type { z } from "zod";

/**
 * Validate and normalise `req.body` with a Zod schema before the route runs.
 * Invalid input throws a ZodError, which the error handler turns into a 400.
 *
 *   router.post("/login", validateBody(loginInputSchema), handler)
 */
export function validateBody<Schema extends z.ZodType>(schema: Schema): RequestHandler {
  return (req, _res, next) => {
    req.body = schema.parse(req.body ?? {});
    next();
  };
}
