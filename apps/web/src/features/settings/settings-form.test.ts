import { describe, expect, it } from "vitest";
import { isSettingsDirty, toFormValues, validateSettings } from "./settings-form";

const saved = {
  shopName: "Somchai Mini Mart",
  shopPhone: null,
  reportTime: "22:00",
  sendReportToLine: true,
  defaultLowStockAt: 5,
};

describe("settings form", () => {
  it("starts from the saved settings and notices changes", () => {
    const initial = toFormValues(saved);
    expect(initial).toEqual({ ...saved, shopPhone: "", defaultLowStockAt: "5" });
    expect(isSettingsDirty(initial, initial)).toBe(false);
    expect(isSettingsDirty({ ...initial, sendReportToLine: false }, initial)).toBe(true);
  });

  it("sends numbers as numbers, and explains bad values", () => {
    expect(validateSettings({ ...toFormValues(saved), defaultLowStockAt: " 8 " })).toEqual({
      ok: true,
      data: { ...toFormValues(saved), defaultLowStockAt: 8 },
    });
    expect(validateSettings({ ...toFormValues(saved), defaultLowStockAt: "2.5" })).toEqual({
      ok: false,
      errors: { defaultLowStockAt: "Enter a whole number, like 5" },
    });
    const bad = validateSettings({ ...toFormValues(saved), shopName: " ", reportTime: "25:00" });
    expect(bad.ok ? {} : bad.errors).toEqual({
      shopName: "Enter the shop name",
      reportTime: "Use a 24-hour time like 22:00",
    });
  });
});
