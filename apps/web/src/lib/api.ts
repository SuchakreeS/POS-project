import { TERMINAL_HEADER } from "@pos/shared";
import { useAuthStore } from "@/features/auth/auth-store";
import { refreshSession } from "@/features/auth/session";
import { useThisPc } from "@/features/terminals/this-pc";
import { API_URL, CLIENT_HEADER } from "./config";
import { createHttpClient } from "./http-client";

/**
 * The client every feature uses for API calls.
 * Sends the access token; on 401 it refreshes once and retries, and if the session is over
 * the app shows the "Please log in again" dialog (the page and its data stay as they are).
 * Also sends this PC's terminal (when one was picked), so audit entries record the device.
 */
export const api = createHttpClient({
  baseUrl: API_URL,
  headers: () => {
    const terminalId = useThisPc.getState().terminalId;
    return terminalId ? { ...CLIENT_HEADER, [TERMINAL_HEADER]: terminalId } : CLIENT_HEADER;
  },
  auth: {
    getAccessToken: () => useAuthStore.getState().accessToken,
    refresh: refreshSession,
    onSessionExpired: () => useAuthStore.getState().expire(),
  },
});
