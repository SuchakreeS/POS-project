import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/http-client";
import { errorMessage } from "@/lib/errors";
import { navSectionsFor } from "./navigation";
import { shouldRetry } from "./query-client";

describe("navSectionsFor", () => {
  const labels = (role: "ADMIN" | "CASHIER") =>
    navSectionsFor(role).flatMap((section) => section.items.map((item) => item.label));

  it("shows Users and Settings to admins only", () => {
    expect(labels("ADMIN")).toEqual([
      "Checkout",
      "Stock",
      "PromptPay",
      "Credit",
      "Orders",
      "Reports",
      "Users",
      "Settings",
    ]);
    expect(labels("CASHIER")).toEqual([
      "Checkout",
      "Stock",
      "PromptPay",
      "Credit",
      "Orders",
      "Reports",
    ]);
  });
});

describe("shouldRetry", () => {
  it("retries network and server errors, at most twice", () => {
    expect(shouldRetry(0, new ApiError(0, "NETWORK", "x"))).toBe(true);
    expect(shouldRetry(1, new ApiError(503, "INTERNAL", "x"))).toBe(true);
    expect(shouldRetry(2, new ApiError(503, "INTERNAL", "x"))).toBe(false);
  });

  it("never retries 4xx or unknown errors", () => {
    expect(shouldRetry(0, new ApiError(404, "NOT_FOUND", "x"))).toBe(false);
    expect(shouldRetry(0, new ApiError(401, "UNAUTHORIZED", "x"))).toBe(false);
    expect(shouldRetry(0, new Error("boom"))).toBe(false);
  });
});

describe("errorMessage", () => {
  it("shows API messages, but not internal ones", () => {
    expect(
      errorMessage(new ApiError(401, "INVALID_CREDENTIALS", "Wrong username or password.")),
    ).toBe("Wrong username or password.");
    expect(errorMessage(new ApiError(500, "INTERNAL", "stack trace…"))).toBe(
      "Something went wrong. Please try again.",
    );
    expect(errorMessage(new Error("x"))).toBe("Something went wrong. Please try again.");
  });
});
