import { z } from "zod";
import { stockCountSchema } from "./catalog";
import { phoneSchema } from "./fields";

/** Shop settings (single row, edited on the Settings page — plan.md → Settings). */
export interface ShopSettings {
  shopName: string;
  shopPhone: string | null;
  /** "HH:mm", Bangkok time. */
  reportTime: string;
  sendReportToLine: boolean;
  /** Pre-fills "Low-stock alert" in Add new item. */
  defaultLowStockAt: number;
}

export const SHOP_NAME_MAX = 80;
const REPORT_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** PATCH /settings — the whole form is sent (admin only). */
export const shopSettingsInputSchema = z.object({
  shopName: z
    .string({ error: "Enter the shop name" })
    .trim()
    .min(1, "Enter the shop name")
    .max(SHOP_NAME_MAX, "Shop name is too long")
    .transform((value) => value.replace(/\s+/g, " ")),
  shopPhone: phoneSchema,
  reportTime: z
    .string({ error: "Enter the report time" })
    .regex(REPORT_TIME, "Use a 24-hour time like 22:00"),
  sendReportToLine: z.boolean(),
  defaultLowStockAt: stockCountSchema("low-stock alert"),
}) satisfies z.ZodType<ShopSettings, unknown>;
export type ShopSettingsInput = z.input<typeof shopSettingsInputSchema>;

// ---------- Terminals (checkout devices) ----------

/** Sent with every request from a PC that is a terminal, so audit entries record the device. */
export const TERMINAL_HEADER = "x-terminal-id";

export const TERMINAL_NAME_MAX = 40;

/** POST /terminals — the code is the bill number prefix ("T2" → T2-000001), so keep it short. */
export const terminalInputSchema = z.object({
  code: z
    .string({ error: "Enter a code" })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{0,4}$/, "1–5 letters or numbers, starting with a letter (like T2)"),
  name: z
    .string({ error: "Enter a name" })
    .trim()
    .min(1, "Enter a name, like Front counter")
    .max(TERMINAL_NAME_MAX, "Name is too long"),
});
export type TerminalInput = z.input<typeof terminalInputSchema>;
