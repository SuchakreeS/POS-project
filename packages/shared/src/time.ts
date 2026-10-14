import { z } from "zod";

/*
 * Shop days run on Bangkok time (plan.md → Reports), while servers run in UTC.
 * Thailand has no daylight saving time, so Bangkok is always UTC+7 and a fixed offset is exact.
 */

export const SHOP_TIMEZONE = "Asia/Bangkok";
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A shop day as "YYYY-MM-DD". */
export type DateKey = string;

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The Bangkok calendar day an instant falls on, e.g. 2026-10-12T18:30Z → "2026-10-13". */
export function bangkokDateKey(instant: Date = new Date()): DateKey {
  return new Date(instant.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** The UTC instants a Bangkok day covers: [start, end). Use as `createdAt >= start AND createdAt < end`. */
export function bangkokDayRange(day: DateKey): { start: Date; end: Date } {
  const match = DATE_KEY.exec(day);
  if (!match) throw new Error(`Invalid day "${day}", expected YYYY-MM-DD`);

  const [, year, month, date] = match.map(Number) as [number, number, number, number];
  const midnightUtc = Date.UTC(year, month - 1, date);
  if (new Date(midnightUtc).toISOString().slice(0, 10) !== day) {
    throw new Error(`Invalid day "${day}"`); // e.g. 2026-02-30
  }

  const start = new Date(midnightUtc - BANGKOK_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** Day key `days` away from `day` (negative = earlier). "2026-10-01", -1 → "2026-09-30". */
export function addDays(day: DateKey, days: number): DateKey {
  const { start } = bangkokDayRange(day);
  return bangkokDateKey(new Date(start.getTime() + days * DAY_MS));
}

/** Is this a real "YYYY-MM-DD" day? */
export function isDateKey(value: string): boolean {
  try {
    bangkokDayRange(value);
    return true;
  } catch {
    return false;
  }
}

export const dateKeySchema = z.string().refine(isDateKey, "Pick a valid date");

/** The UTC instants from the start of `from` to the end of `to` (both Bangkok days, inclusive). */
export function bangkokPeriod(from: DateKey, to: DateKey): { start: Date; end: Date } {
  return { start: bangkokDayRange(from).start, end: bangkokDayRange(to).end };
}
