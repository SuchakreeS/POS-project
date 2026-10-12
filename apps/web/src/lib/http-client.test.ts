import { describe, expect, it, vi } from "vitest";
import { ApiError, createHttpClient, type AuthHooks } from "./http-client";

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const unauthorized = () => json(401, { error: { code: "UNAUTHORIZED", message: "Log in first" } });

function setup(responses: (Response | Error)[], auth?: Partial<AuthHooks>) {
  const fetchMock = vi.fn<typeof fetch>(async () => {
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    if (next instanceof Error) throw next;
    return next;
  });
  let token: string | null = "old-token";
  const hooks: AuthHooks = {
    getAccessToken: () => token,
    refresh: vi.fn(async () => {
      token = "new-token";
      return true;
    }),
    onSessionExpired: vi.fn(),
    ...auth,
  };
  const client = createHttpClient({
    baseUrl: "http://api.test",
    headers: { "x-pos-client": "web" },
    auth: hooks,
    fetch: fetchMock,
  });
  const headersOf = (call: number) =>
    fetchMock.mock.calls[call]?.[1]?.headers as Record<string, string>;
  return { client, fetchMock, hooks, headersOf };
}

describe("createHttpClient", () => {
  it("sends JSON, the client header, cookies and the access token", async () => {
    const { client, fetchMock, headersOf } = setup([json(200, { ok: true })]);

    await expect(client.post("/things", { a: 1 })).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test/things");
    expect(init).toMatchObject({ method: "POST", body: '{"a":1}', credentials: "include" });
    expect(headersOf(0)).toEqual({
      "x-pos-client": "web",
      "Content-Type": "application/json",
      Authorization: "Bearer old-token",
    });
  });

  it("does not send the token or refresh when auth is false", async () => {
    const { client, hooks, headersOf } = setup([unauthorized()]);

    await expect(client.get("/public", { auth: false })).rejects.toMatchObject({ status: 401 });
    expect(headersOf(0).Authorization).toBeUndefined();
    expect(hooks.refresh).not.toHaveBeenCalled();
  });

  it("refreshes once on 401 and retries with the new token", async () => {
    const { client, hooks, headersOf, fetchMock } = setup([unauthorized(), json(200, { id: 1 })]);

    await expect(client.get("/me")).resolves.toEqual({ id: 1 });
    expect(hooks.refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(headersOf(1).Authorization).toBe("Bearer new-token");
    expect(hooks.onSessionExpired).not.toHaveBeenCalled();
  });

  it("reports an expired session when the refresh fails", async () => {
    const { client, hooks, fetchMock } = setup([unauthorized()], {
      refresh: vi.fn(async () => false),
    });

    await expect(client.get("/me")).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(hooks.onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("reports an expired session when the retry is still 401", async () => {
    const { client, hooks } = setup([unauthorized(), unauthorized()]);

    await expect(client.get("/me")).rejects.toMatchObject({ status: 401 });
    expect(hooks.refresh).toHaveBeenCalledTimes(1);
    expect(hooks.onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("does not end the session when the refresh can't reach the server", async () => {
    const networkError = new ApiError(0, "NETWORK", "offline");
    const { client, hooks } = setup([unauthorized()], {
      refresh: vi.fn(async () => Promise.reject(networkError)),
    });

    await expect(client.get("/me")).rejects.toBe(networkError);
    expect(hooks.onSessionExpired).not.toHaveBeenCalled();
  });

  it("turns a failed fetch into a NETWORK error", async () => {
    const { client } = setup([new TypeError("Failed to fetch")]);

    const error = await client.get("/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: "NETWORK", isNetwork: true });
  });

  it("passes aborts through unchanged", async () => {
    const controller = new AbortController();
    controller.abort();
    const abort = new DOMException("Aborted", "AbortError");
    const { client } = setup([abort]);

    await expect(client.get("/x", { signal: controller.signal })).rejects.toBe(abort);
  });

  it("reads the API error body", async () => {
    const { client } = setup([
      json(400, {
        error: {
          code: "VALIDATION",
          message: "Enter your username",
          issues: [{ path: ["username"], message: "Enter your username" }],
        },
      }),
    ]);

    await expect(client.post("/auth/login", {}, { auth: false })).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION",
      message: "Enter your username",
      issues: [{ path: ["username"], message: "Enter your username" }],
    });
  });

  it("falls back to a code from the status when the body isn't JSON", async () => {
    const { client } = setup([
      new Response("<html>Bad gateway</html>", { status: 502 }),
      new Response("nope", { status: 404 }),
    ]);

    await expect(client.get("/x", { auth: false })).rejects.toMatchObject({
      status: 502,
      code: "INTERNAL",
    });
    await expect(client.get("/y", { auth: false })).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("returns undefined for 204 No Content", async () => {
    const { client } = setup([new Response(null, { status: 204 })]);
    await expect(client.post("/auth/logout", undefined, { auth: false })).resolves.toBeUndefined();
  });
});
