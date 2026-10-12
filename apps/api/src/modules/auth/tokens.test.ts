import { describe, expect, it } from "vitest";
import { hashRefreshToken, newRefreshToken, signAccessToken, verifyAccessToken } from "./tokens";

describe("access tokens", () => {
  const claims = { userId: "user-1", role: "CASHIER" as const, displayName: "Ploy" };

  it("round-trips the claims", async () => {
    const token = await signAccessToken(claims);
    await expect(verifyAccessToken(token)).resolves.toEqual(claims);
  });

  it("rejects a tampered token", async () => {
    const token = await signAccessToken(claims);
    const [header, payload, signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload!, "base64url").toString()),
        role: "ADMIN",
      }),
    ).toString("base64url");
    await expect(verifyAccessToken(`${header}.${forgedPayload}.${signature}`)).rejects.toThrow();
  });

  it("rejects garbage", async () => {
    await expect(verifyAccessToken("not-a-token")).rejects.toThrow();
  });
});

describe("refresh tokens", () => {
  it("are long and unique", () => {
    const a = newRefreshToken();
    const b = newRefreshToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43); // 32 random bytes, base64url
  });

  it("hash deterministically, and differently per token", () => {
    const token = newRefreshToken();
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).not.toBe(hashRefreshToken(newRefreshToken()));
    expect(hashRefreshToken(token)).not.toContain(token);
  });
});
