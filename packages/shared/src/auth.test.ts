import { describe, expect, it } from "vitest";
import { loginInputSchema, newPasswordSchema, usernameSchema } from "./auth";

describe("loginInputSchema", () => {
  it("trims and lowercases the username", () => {
    const result = loginInputSchema.parse({ username: "  Admin ", password: "secret123" });
    expect(result.username).toBe("admin");
  });

  it("keeps the password exactly as typed", () => {
    const result = loginInputSchema.parse({ username: "nok", password: " Pa ss " });
    expect(result.password).toBe(" Pa ss ");
  });

  it("rejects empty fields with friendly messages", () => {
    const result = loginInputSchema.safeParse({ username: "  ", password: "" });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((issue) => issue.message);
    expect(messages).toEqual(["Enter your username", "Enter your password"]);
  });
});

describe("usernameSchema", () => {
  it("normalises usernames", () => {
    expect(usernameSchema.parse("  Nok.K ")).toBe("nok.k");
  });

  it.each(["ab", "nok kaew", "นก", "a".repeat(51)])("rejects %j", (value) => {
    expect(usernameSchema.safeParse(value).success).toBe(false);
  });
});

describe("newPasswordSchema", () => {
  it("needs at least 8 characters", () => {
    expect(newPasswordSchema.safeParse("1234567").success).toBe(false);
    expect(newPasswordSchema.safeParse("12345678").success).toBe(true);
  });
});
