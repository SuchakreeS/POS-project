/** Error codes the API can return in `{ error: { code, message } }`. The web app switches on these. */
export const API_ERROR_CODES = [
  "VALIDATION",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "INVALID_CREDENTIALS",
  "ACCOUNT_DISABLED",
  "SESSION_EXPIRED",
  "TOO_MANY_REQUESTS",
  "INTERNAL",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorIssue {
  path: (string | number)[];
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    issues?: ApiErrorIssue[];
  };
}
