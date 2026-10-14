import type { ApiErrorBody, ApiErrorCode, ApiErrorIssue } from "@pos/shared";

/** API error codes plus NETWORK (the server could not be reached at all). */
export type ClientErrorCode = ApiErrorCode | "NETWORK";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ClientErrorCode,
    message: string,
    readonly issues?: ApiErrorIssue[],
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNetwork() {
    return this.code === "NETWORK";
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** Send the access token and refresh it once on 401. Default true. */
  auth?: boolean;
  /** Extra headers for this request (e.g. Idempotency-Key). */
  headers?: Record<string, string>;
}

/** How the client plugs into the auth layer. Kept as callbacks so this file knows nothing about stores. */
export interface AuthHooks {
  getAccessToken(): string | null;
  /** Get a new access token. Resolves true when a new token is ready, false when the session is over. */
  refresh(): Promise<boolean>;
  /** Called when a protected request fails because the session is over. */
  onSessionExpired(): void;
}

export interface HttpClientOptions {
  baseUrl: string;
  /** Sent with every request; a function is called each time (for values that change). */
  headers?: Record<string, string> | (() => Record<string, string>);
  auth?: AuthHooks;
  fetch?: typeof fetch;
}

export type HttpClient = ReturnType<typeof createHttpClient>;

const NETWORK_MESSAGE = "Can't reach the server. Check the internet connection and try again.";

export function createHttpClient(options: HttpClientOptions) {
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function send(path: string, init: RequestOptions, token: string | null): Promise<Response> {
    const base = typeof options.headers === "function" ? options.headers() : options.headers;
    const headers: Record<string, string> = { ...base, ...init.headers };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      return await doFetch(`${options.baseUrl}${path}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        credentials: "include",
        signal: init.signal,
      });
    } catch (error) {
      if (init.signal?.aborted) throw error; // let React Query see the abort as-is
      throw new ApiError(0, "NETWORK", NETWORK_MESSAGE);
    }
  }

  async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    const auth = init.auth === false ? undefined : options.auth;
    let res = await send(path, init, auth?.getAccessToken() ?? null);

    if (res.status === 401 && auth) {
      if (await auth.refresh()) {
        res = await send(path, init, auth.getAccessToken());
      }
      if (res.status === 401) {
        auth.onSessionExpired();
      }
    }

    return parseResponse<T>(res);
  }

  return {
    request,
    get: <T>(path: string, init?: Omit<RequestOptions, "method" | "body">) =>
      request<T>(path, { ...init, method: "GET" }),
    post: <T>(path: string, body?: unknown, init?: Omit<RequestOptions, "method" | "body">) =>
      request<T>(path, { ...init, method: "POST", body }),
    patch: <T>(path: string, body?: unknown, init?: Omit<RequestOptions, "method" | "body">) =>
      request<T>(path, { ...init, method: "PATCH", body }),
    delete: <T>(path: string, init?: Omit<RequestOptions, "method" | "body">) =>
      request<T>(path, { ...init, method: "DELETE" }),
  };
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;

  const body: unknown = await res.json().catch(() => undefined);
  if (res.ok) return body as T;

  const error = (body as Partial<ApiErrorBody> | undefined)?.error;
  throw new ApiError(
    res.status,
    error?.code ?? codeForStatus(res.status),
    error?.message ?? `Request failed (${res.status})`,
    error?.issues,
  );
}

/** Fallback when the response has no `{ error }` body (e.g. a proxy error page). */
function codeForStatus(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return "VALIDATION";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "TOO_MANY_REQUESTS";
    default:
      return "INTERNAL";
  }
}
