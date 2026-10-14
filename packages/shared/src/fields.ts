import { z } from "zod";

/** Longest free-text note (restock, adjust, customer, repayment, void). */
export const NOTE_MAX = 200;

/** Optional text input: blank or missing becomes null. */
export const optionalText = (schema: z.ZodType<string>) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    schema.nullable().default(null),
  );

export const noteSchema = optionalText(z.string().trim().max(NOTE_MAX, "Note is too long"));

export const PHONE_MAX = 20;

/** Optional phone number (customers, shop): digits, spaces, + - ( ). */
export const phoneSchema = optionalText(
  z
    .string()
    .trim()
    .max(PHONE_MAX, "Phone number is too long")
    .regex(/^[0-9+\-\s()]+$/, "Use only numbers, spaces, + or -"),
);
