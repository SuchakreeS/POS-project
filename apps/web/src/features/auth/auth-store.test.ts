import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "./auth-store";

const user = { id: "u1", username: "nok", displayName: "Nok", role: "CASHIER" as const };
const store = () => useAuthStore.getState();

beforeEach(() => {
  useAuthStore.setState({ status: "checking", user: null, accessToken: null });
});

describe("auth store", () => {
  it("signs in and out", () => {
    store().signIn({ accessToken: "t", user });
    expect(store()).toMatchObject({ status: "signedIn", user, accessToken: "t" });

    store().signOut();
    expect(store()).toMatchObject({ status: "signedOut", user: null, accessToken: null });
  });

  it("keeps the user but drops the token when a signed-in session expires", () => {
    store().signIn({ accessToken: "t", user });
    store().expire();
    expect(store()).toMatchObject({ status: "expired", user, accessToken: null });
  });

  it("goes to signed out if the session ends while the app is still starting", () => {
    store().expire();
    expect(store().status).toBe("signedOut");
  });

  it("does nothing when already signed out", () => {
    store().signOut();
    store().expire();
    expect(store().status).toBe("signedOut");
  });
});
