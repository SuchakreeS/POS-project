import type { AuthResponse, AuthUser } from "@pos/shared";
import { create } from "zustand";

/**
 * - checking:  app just opened, asking the API if the refresh cookie is still good
 * - signedIn:  we have a user and an access token
 * - expired:   the session ended while the app was open; keep the user and the page, ask for the password again
 * - signedOut: nobody is logged in
 */
export type AuthStatus = "checking" | "signedIn" | "expired" | "signedOut";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /** Kept in memory only (never localStorage), so a script injected into the page can't read it later. */
  accessToken: string | null;

  signIn(session: AuthResponse): void;
  signOut(): void;
  /** The session ended (refresh failed). Only meaningful while signed in. */
  expire(): void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: "checking",
  user: null,
  accessToken: null,

  signIn: ({ accessToken, user }) => set({ status: "signedIn", user, accessToken }),

  signOut: () => set({ status: "signedOut", user: null, accessToken: null }),

  expire: () => {
    const { status } = get();
    if (status === "signedIn") set({ status: "expired", accessToken: null });
    else if (status === "checking") set({ status: "signedOut", user: null, accessToken: null });
  },
}));

/** The signed-in user. Only use inside routes guarded by RequireAuth. */
export function useCurrentUser(): AuthUser {
  const user = useAuthStore((state) => state.user);
  if (!user) throw new Error("useCurrentUser() used outside a signed-in route");
  return user;
}
