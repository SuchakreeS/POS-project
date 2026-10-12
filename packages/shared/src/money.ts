/**
 * Money rules (plan.md → Business rules → Money):
 * every amount is an integer number of satang (100 THB = 10000 satang).
 * Do all math on satang and convert to THB only for display.
 */

/** Largest amount the app accepts anywhere: 100,000,000.00 THB. Far below Number.MAX_SAFE_INTEGER. */
export const MAX_SATANG = 10_000_000_000;

export function isSatang(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= MAX_SATANG;
}

/** THB as a number (e.g. 12.5) → satang. For code and seed data; parse typed text with `parseThb`. */
export function toSatang(thb: number): number {
  if (!Number.isFinite(thb)) throw new Error(`Invalid money amount: ${thb}`);
  return Math.round(thb * 100);
}

// Digits (commas allowed between them), optional ".", at most 2 decimals: "1,250", "12.5", ".50", "12."
const THB_INPUT = /^(\d{1,3}(,\d{3})+|\d*)(\.(\d{0,2}))?$/;

/**
 * Text typed by a person → satang, or null if it isn't a valid amount.
 * Accepts "12", "12.5", "1,250.00", " 30 ฿". Rejects negatives, 3+ decimals and anything too large.
 * Works on the digits directly, so there is no floating-point rounding.
 */
export function parseThb(text: string): number | null {
  const cleaned = text.replace(/฿/g, "").trim();
  const match = THB_INPUT.exec(cleaned);
  if (!match) return null;

  const baht = (match[1] ?? "").replace(/,/g, "");
  const fraction = match[4] ?? "";
  if (baht === "" && fraction === "") return null; // "" or "."

  const satang = Number(baht || "0") * 100 + Number(fraction.padEnd(2, "0"));
  return satang <= MAX_SATANG ? satang : null;
}

const thbFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Satang → "12,450.00" (no currency sign). Use in tables where the column says ฿. */
export function formatSatang(satang: number): string {
  return thbFormatter.format(satang / 100);
}

/** Satang → "30.00 ฿". */
export function formatTHB(satang: number): string {
  return `${formatSatang(satang)} ฿`;
}

/** Satang → text for an input field: 1250 → "12.50", 3000 → "30". */
export function satangToInput(satang: number): string {
  return satang % 100 === 0 ? String(satang / 100) : (satang / 100).toFixed(2);
}
