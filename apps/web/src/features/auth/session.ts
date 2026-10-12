import type { AuthResponse } from "@pos/shared";
import { API_URL, CLIENT_HEADER } from "@/lib/config";
import { createHttpClient, isApiError } from "@/lib/http-client";
import { useAuthStore } from "./auth-store";

/** Unauthenticated client for the /auth endpoints (they use the refresh cookie, not the access token). */
export const authClient = createHttpClient({ baseUrl: API_URL, headers: CLIENT_HEADER });

let refreshing: Promise<boolean> | null = null;

/**
 * Swap the refresh cookie for a new access token.
 * Resolves true when signed in, false when the session is over; throws ApiError NETWORK if the API can't be reached.
 *
 * Concurrent callers share one request: the API rotates the refresh token on every call,
 * so two parallel refreshes with the same cookie would make the second one fail.
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= withCrossTabLock(requestRefresh).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function requestRefresh(): Promise<boolean> {
  try {
    const session = await authClient.post<AuthResponse>("/auth/refresh");
    useAuthStore.getState().signIn(session);
    return true;
  } catch (error) {
    if (isApiError(error) && error.status === 401) return false;
    throw error;
  }
}

/**
 * Tabs share the refresh cookie too. The Web Locks API makes tabs take turns,
 * so the second tab sends the cookie the first tab just received.
 */
function withCrossTabLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !("locks" in navigator)) return task();
  return navigator.locks.request("pos-auth-refresh", task);
}
