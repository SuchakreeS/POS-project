import type { AuthResponse } from "@pos/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "./auth-store";
import { refreshSession } from "./session";

const session: AuthResponse = {
  accessToken: "token-1",
  user: { id: "u1", username: "nok", displayName: "Nok", role: "CASHIER" },
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  useAuthStore.setState({ status: "checking", user: null, accessToken: null });
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("refreshSession", () => {
  it("shares one request between callers at the same time (the API rotates the token on each call)", async () => {
    fetchMock.mockResolvedValue(Response.json(session));

    const results = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(results).toEqual([true, true, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({
      status: "signedIn",
      accessToken: "token-1",
      user: session.user,
    });
  });

  it("starts a new request once the previous one has finished", async () => {
    fetchMock.mockImplementation(async () => Response.json(session));

    await refreshSession();
    await refreshSession();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("resolves false when the session is over", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { error: { code: "SESSION_EXPIRED", message: "Your session has ended." } },
        { status: 401 },
      ),
    );

    await expect(refreshSession()).resolves.toBe(false);
    expect(useAuthStore.getState().status).toBe("checking"); // the caller decides what to do
  });

  it("throws a NETWORK error when the API can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(refreshSession()).rejects.toMatchObject({ code: "NETWORK" });
  });
});
