import { describe, expect, it } from "vitest";
import { formatTHB, toSatang } from "./money";

describe("money helpers", () => {
  it("converts THB to integer satang", () => {
    expect(toSatang("12.50")).toBe(1250);
    expect(toSatang(0.1 + 0.2)).toBe(30);
    expect(toSatang("1,245.00")).toBe(124500);
  });

  it("formats satang as baht", () => {
    expect(formatTHB(3000)).toBe("30.00 ฿");
    expect(formatTHB(124500)).toBe("1,245.00 ฿");
  });
});
