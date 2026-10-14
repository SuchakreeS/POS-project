import { describe, expect, it } from "vitest";
import { initialOf } from "./initials";

describe("initialOf", () => {
  it("takes the first letter, uppercased", () => {
    expect(initialOf("  somchai")).toBe("S");
    expect(initialOf("สมชาย")).toBe("ส");
  });

  it("skips Thai leading vowels and keeps combining marks together", () => {
    expect(initialOf("เอก")).toBe("อ");
    expect(initialOf("ไก่")).toBe("ก่");
  });

  it("falls back to ? for an empty name", () => {
    expect(initialOf("   ")).toBe("?");
  });
});
