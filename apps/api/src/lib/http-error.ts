import type { ApiErrorCode, ApiErrorIssue } from "@pos/shared";

/**
 * Throw from services or routes to send a clean JSON error:
 *   throw HttpError.unauthorized("Wrong username or password.", "INVALID_CREDENTIALS")
 * The error handler turns it into `{ error: { code, message } }` with the right status.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    /** Field-level messages, so forms can show the error under the right input. */
    public readonly issues?: ApiErrorIssue[],
  ) {
    super(message);
    this.name = "HttpError";
  }

  /** 409 for a value that must be unique, shown under that field: `HttpError.duplicate("barcode", "…")`. */
  static duplicate(field: string, message: string) {
    return new HttpError(409, "CONFLICT", message, [{ path: [field], message }]);
  }

  static badRequest(message: string, code: ApiErrorCode = "VALIDATION") {
    return new HttpError(400, code, message);
  }

  static unauthorized(message = "Please log in.", code: ApiErrorCode = "UNAUTHORIZED") {
    return new HttpError(401, code, message);
  }

  /** The login is over (bad or old token, revoked session, user turned off): the web app asks to log in again. */
  static sessionEnded() {
    return new HttpError(401, "SESSION_EXPIRED", "Your session has ended. Please log in again.");
  }

  static forbidden(
    message = "You don't have permission to do this.",
    code: ApiErrorCode = "FORBIDDEN",
  ) {
    return new HttpError(403, code, message);
  }

  static notFound(message = "Not found.", code: ApiErrorCode = "NOT_FOUND") {
    return new HttpError(404, code, message);
  }

  static conflict(message: string, code: ApiErrorCode = "CONFLICT") {
    return new HttpError(409, code, message);
  }
}
