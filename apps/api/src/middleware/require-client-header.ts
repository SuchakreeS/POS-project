import type { RequestHandler } from "express";
import { AUTH } from "../config";
import { HttpError } from "../lib/http-error";

/**
 * Cookie-based routes (/auth/refresh, /auth/logout) require our custom header.
 * A browser can't add it to a cross-site request without a CORS preflight, and our CORS only
 * allows the web app's origin — so other sites can't trigger these with the user's cookie.
 */
export const requireClientHeader: RequestHandler = (req, _res, next) => {
  if (!req.get(AUTH.clientHeader)) throw HttpError.forbidden("Missing client header.");
  next();
};
