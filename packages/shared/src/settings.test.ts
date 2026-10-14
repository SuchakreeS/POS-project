import { describe, expect, it } from "vitest";
import { shopSettingsInputSchema, terminalInputSchema } from "./settings";

describe("shopSettingsInputSchema", () => {
  const valid = {
    shopName: "  Somchai   Mini Mart ",
    shopPhone: "",
    reportTime: "22:00",
    sendReportToLine: true,
    defaultLowStockAt: 5,
  };

  it("cleans the shop name and turns a blank phone into null", () => {
    expect(shopSettingsInputSchema.parse(valid)).toEqual({
      ...valid,
      shopName: "Somchai Mini Mart",
      shopPhone: null,
    });
  });

  it("needs a real 24-hour report time", () => {
    for (const reportTime of ["00:00", "09:30", "23:59"]) {
      expect(shopSettingsInputSchema.safeParse({ ...valid, reportTime }).success).toBe(true);
    }
    for (const reportTime of ["24:00", "9:30", "22:60", "10pm", ""]) {
      expect(shopSettingsInputSchema.safeParse({ ...valid, reportTime }).success).toBe(false);
    }
  });

  it("rejects an empty name and a negative low-stock alert", () => {
    expect(shopSettingsInputSchema.safeParse({ ...valid, shopName: "  " }).success).toBe(false);
    expect(shopSettingsInputSchema.safeParse({ ...valid, defaultLowStockAt: -1 }).success).toBe(
      false,
    );
  });
});

describe("terminalInputSchema", () => {
  it("uppercases short codes that start with a letter", () => {
    expect(terminalInputSchema.parse({ code: " t2 ", name: "Back counter" })).toEqual({
      code: "T2",
      name: "Back counter",
    });
    for (const code of ["2T", "T-2", "TOOLONG", ""]) {
      expect(terminalInputSchema.safeParse({ code, name: "x" }).success).toBe(false);
    }
  });
});
