import type { AuthResponse, LoginInput } from "@pos/shared";
import { useAuthStore } from "./auth-store";
import { authClient } from "./session";

export async function login(input: LoginInput) {
  const session = await authClient.post<AuthResponse>("/auth/login", input);
  useAuthStore.getState().signIn(session);
  return session.user;
}

/** End the session on the server, then locally. Signs out locally even if the API can't be reached. */
export async function logout() {
  try {
    await authClient.post<void>("/auth/logout");
  } catch {
    // The refresh cookie may already be gone or the API is down; the local sign-out below still happens.
  } finally {
    useAuthStore.getState().signOut();
  }
}
