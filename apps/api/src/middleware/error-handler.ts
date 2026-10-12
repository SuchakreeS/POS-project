import type { ApiErrorBody } from "@pos/shared";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/http-error";

export const notFound: RequestHandler = (req, res) => {
  const body: ApiErrorBody = {
    error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` },
  };
  res.status(404).json(body);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    const body: ApiErrorBody = { error: { code: err.code, message: err.message } };
    res.status(err.status).json(body);
    return;
  }

  if (err instanceof ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: "VALIDATION",
        message: err.issues[0]?.message ?? "Invalid input",
        issues: err.issues.map((issue) => ({
          path: issue.path.filter((part): part is string | number => typeof part !== "symbol"),
          message: issue.message,
        })),
      },
    };
    res.status(400).json(body);
    return;
  }

  // Malformed JSON body from express.json()
  if (err instanceof SyntaxError && "body" in err) {
    const body: ApiErrorBody = { error: { code: "VALIDATION", message: "Invalid JSON body" } };
    res.status(400).json(body);
    return;
  }

  console.error(err);
  const body: ApiErrorBody = { error: { code: "INTERNAL", message: "Something went wrong" } };
  res.status(500).json(body);
};
