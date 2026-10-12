/**
 * Money rules (see plan.md → Business rules → Money):
 * all amounts are integers in satang (100 THB = 10000). Convert to THB only for display.
 */

/** Convert a THB amount typed by a person (e.g. "12.50" or 12.5) to integer satang. */
export function toSatang(thb: number | string): number {
  const value = typeof thb === "string" ? Number(thb.replace(/,/g, "")) : thb;
  if (!Number.isFinite(value)) throw new Error(`Invalid money amount: ${thb}`);
  return Math.round(value * 100);
}

const thbFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format satang for display, e.g. 1245000 → "12,450.00". */
export function formatSatang(satang: number): string {
  return thbFormatter.format(satang / 100);
}

/** Format satang with the baht sign, e.g. 3000 → "30.00 ฿". */
export function formatTHB(satang: number): string {
  return `${formatSatang(satang)} ฿`;
}
