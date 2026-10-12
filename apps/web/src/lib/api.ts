import { refreshSession } from "@/features/auth/session";
import { useAuthStore } from "@/features/auth/auth-store";
import { API_URL, CLIENT_HEADER } from "./config";
import { createHttpClient } from "./http-client";

/**
 * The client every feature uses for API calls.
 * Sends the access token; on 401 it refreshes once and retries, and if the session is over
 * the app shows the "Please log in again" dialog (the page and its data stay as they are).
 */
export const api = createHttpClient({
  baseUrl: API_URL,
  headers: CLIENT_HEADER,
  auth: {
    getAccessToken: () => useAuthStore.getState().accessToken,
    refresh: refreshSession,
    onSessionExpired: () => useAuthStore.getState().expire(),
  },
});
