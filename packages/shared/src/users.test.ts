import { describe, expect, it } from "vitest";
import { passwordResetSchema, userCreateSchema, userUpdateSchema } from "./users";

describe("userCreateSchema", () => {
  const valid = {
    displayName: " Nok ",
    username: " Nok.K ",
    role: "CASHIER",
    password: "12345678",
  };

  it("trims, lowercases the username and keeps the password as typed", () => {
    expect(userCreateSchema.parse(valid)).toEqual({
      displayName: "Nok",
      username: "nok.k",
      role: "CASHIER",
      password: "12345678",
    });
  });

  it("explains what's wrong with each field", () => {
    const result = userCreateSchema.safeParse({
      displayName: "",
      username: "no spaces",
      role: "OWNER",
      password: "short",
    });
    const messages = Object.fromEntries(
      (result.error?.issues ?? []).map((issue) => [issue.path[0], issue.message]),
    );
    expect(messages).toEqual({
      displayName: "Enter a name",
      username: "Use only letters, numbers, dot, dash or underscore",
      role: "Pick a role",
      password: "Password needs at least 8 characters",
    });
  });
});

describe("userUpdateSchema / passwordResetSchema", () => {
  it("edits never carry a password; a reset needs 8+ characters", () => {
    expect(
      userUpdateSchema.parse({ displayName: "Nok", username: "nok", role: "ADMIN", password: "x" }),
    ).toEqual({ displayName: "Nok", username: "nok", role: "ADMIN" });
    expect(passwordResetSchema.safeParse({ password: "1234567" }).success).toBe(false);
  });
});
