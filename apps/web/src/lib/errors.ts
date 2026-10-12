import { isApiError } from "./http-client";

const FALLBACK = "Something went wrong. Please try again.";

/**
 * A message that is safe to show to staff.
 * API messages are written for users; unexpected server errors get a generic line instead.
 */
export function errorMessage(error: unknown): string {
  if (!isApiError(error) || error.code === "INTERNAL") return FALLBACK;
  return error.message;
}
