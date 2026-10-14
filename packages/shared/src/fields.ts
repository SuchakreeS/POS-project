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
