import { describe, expect, it } from "vitest";
import {
  formatSatang,
  formatTHB,
  isSatang,
  MAX_SATANG,
  parseThb,
  satangToInput,
  toSatang,
} from "./money";

describe("toSatang", () => {
  it("converts THB numbers without float drift", () => {
    expect(toSatang(12.5)).toBe(1250);
    expect(toSatang(0.1 + 0.2)).toBe(30);
    expect(toSatang(19.99)).toBe(1999);
  });

  it("rejects non-numbers", () => {
    expect(() => toSatang(Number.NaN)).toThrow();
    expect(() => toSatang(Infinity)).toThrow();
  });
});

describe("parseThb", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.50", 1250],
    ["12.", 1200],
    [".5", 50],
    ["0", 0],
    ["1,250.75", 125075],
    ["1,000,000", 100000000],
    ["  30 ฿ ", 3000],
    ["฿30", 3000],
    ["0.07", 7],
  ])("%j → %i satang", (text, satang) => {
    expect(parseThb(text)).toBe(satang);
  });

  it.each(["", " ", ".", "-5", "12.345", "1,25", "12,34.5", "abc", "1e3", "12 50", "100000001"])(
    "rejects %j",
    (text) => {
      expect(parseThb(text)).toBeNull();
    },
  );

  it("accepts the maximum amount exactly", () => {
    expect(parseThb("100,000,000.00")).toBe(MAX_SATANG);
  });
});

describe("isSatang", () => {
  it("accepts whole, non-negative amounts up to the max", () => {
    expect(isSatang(0)).toBe(true);
    expect(isSatang(MAX_SATANG)).toBe(true);
  });

  it.each([-1, 1.5, MAX_SATANG + 1, Number.NaN, "100", null])("rejects %j", (value) => {
    expect(isSatang(value)).toBe(false);
  });
});

describe("formatting", () => {
  it("formats satang as baht", () => {
    expect(formatSatang(124500)).toBe("1,245.00");
    expect(formatTHB(3000)).toBe("30.00 ฿");
    expect(formatTHB(5)).toBe("0.05 ฿");
    expect(formatTHB(-5000)).toBe("-50.00 ฿");
  });

  it("formats satang for an input field", () => {
    expect(satangToInput(3000)).toBe("30");
    expect(satangToInput(1250)).toBe("12.50");
    expect(satangToInput(5)).toBe("0.05");
    expect(parseThb(satangToInput(123456))).toBe(123456);
  });
});
