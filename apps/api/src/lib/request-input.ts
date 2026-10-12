import type { Request } from "express";
import type { z } from "zod";
import { HttpError } from "./http-error";

/**
 * Validate the query string. (Express 5 makes `req.query` read-only, so it can't be replaced
 * in a middleware the way validateBody replaces `req.body`.) Invalid input → 400 via ZodError.
 */
export function parseQuery<Schema extends z.ZodType>(
  schema: Schema,
  req: Request,
): z.output<Schema> {
  return schema.parse(req.query);
}

/** A route parameter such as `:id`, as a plain string. */
export function routeParam(req: Request, name: string): string {
  const value: unknown = req.params[name];
  if (typeof value !== "string" || value === "") throw HttpError.notFound();
  return value;
}
