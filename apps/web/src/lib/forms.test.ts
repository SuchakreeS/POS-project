import { describe, expect, it } from "vitest";
import { apiFieldErrors, fieldErrorsFrom } from "./forms";
import { ApiError } from "./http-client";

const FIELDS = ["name", "phone"] as const;

describe("fieldErrorsFrom", () => {
  it("keeps the first message per known field", () => {
    expect(
      fieldErrorsFrom(
        [
          { path: ["name"], message: "Enter a name" },
          { path: ["name"], message: "Too long" },
          { path: ["phone"], message: "Bad phone" },
          { path: ["other"], message: "Not on this form" },
          { path: [], message: "Whole form" },
        ],
        FIELDS,
      ),
    ).toEqual({ name: "Enter a name", phone: "Bad phone" });
  });
});

describe("apiFieldErrors", () => {
  it("maps API issues to fields, or null when they aren't about the form", () => {
    const taken = new ApiError(409, "CONFLICT", "Taken", [{ path: ["name"], message: "Taken" }]);
    expect(apiFieldErrors(taken, FIELDS)).toEqual({ name: "Taken" });
    expect(apiFieldErrors(new ApiError(500, "INTERNAL", "Oops"), FIELDS)).toBeNull();
    expect(
      apiFieldErrors(
        new ApiError(400, "VALIDATION", "x", [{ path: ["role"], message: "x" }]),
        FIELDS,
      ),
    ).toBeNull();
    expect(apiFieldErrors(new Error("boom"), FIELDS)).toBeNull();
  });
});
