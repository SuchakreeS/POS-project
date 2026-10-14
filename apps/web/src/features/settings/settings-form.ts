import { shopSettingsInputSchema, type ShopSettings, type ShopSettingsInput } from "@pos/shared";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/forms";

/** The Settings form as typed (numbers stay text until saved). */
export interface SettingsFormValues {
  shopName: string;
  shopPhone: string;
  reportTime: string;
  sendReportToLine: boolean;
  defaultLowStockAt: string;
}

export const SETTINGS_FIELDS = [
  "shopName",
  "shopPhone",
  "reportTime",
  "sendReportToLine",
  "defaultLowStockAt",
] as const satisfies readonly (keyof SettingsFormValues)[];
export type SettingsField = (typeof SETTINGS_FIELDS)[number];

export function toFormValues(settings: ShopSettings): SettingsFormValues {
  return {
    shopName: settings.shopName,
    shopPhone: settings.shopPhone ?? "",
    reportTime: settings.reportTime,
    sendReportToLine: settings.sendReportToLine,
    defaultLowStockAt: String(settings.defaultLowStockAt),
  };
}

export function isSettingsDirty(values: SettingsFormValues, initial: SettingsFormValues) {
  return SETTINGS_FIELDS.some((field) => values[field] !== initial[field]);
}

export type SettingsValidation =
  { ok: true; data: ShopSettingsInput } | { ok: false; errors: FieldErrors<SettingsField> };

/** Check the form with the same schema the API uses. */
export function validateSettings(values: SettingsFormValues): SettingsValidation {
  const count = values.defaultLowStockAt.trim();
  if (!/^\d+$/.test(count)) {
    return { ok: false, errors: { defaultLowStockAt: "Enter a whole number, like 5" } };
  }
  const data = { ...values, defaultLowStockAt: Number(count) };
  const result = shopSettingsInputSchema.safeParse(data);
  return result.success
    ? { ok: true, data }
    : { ok: false, errors: fieldErrorsFrom(result.error.issues, SETTINGS_FIELDS) };
}
