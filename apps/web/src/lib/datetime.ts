import { addDays, bangkokDateKey, SHOP_TIMEZONE, type DateKey } from "@pos/shared";

/*
 * Dates and times as staff read them: always in shop time (Bangkok), whatever the PC's clock zone.
 */

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "14:32" */
export function formatTime(iso: string | Date): string {
  return timeFormat.format(new Date(iso));
}

/** "Today", "Yesterday" or "Mon, 12 Oct 2026". */
export function formatDayLabel(day: DateKey, now: Date = new Date()): string {
  const today = bangkokDateKey(now);
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  // Noon Bangkok time on that day, so the formatter can't slip to the day before or after.
  return dayFormat.format(new Date(`${day}T12:00:00+07:00`));
}

/** Group items (already sorted) by shop day, keeping their order. */
export function groupByDay<T>(
  items: readonly T[],
  dateOf: (item: T) => string,
): { day: DateKey; items: T[] }[] {
  const groups: { day: DateKey; items: T[] }[] = [];
  for (const item of items) {
    const day = bangkokDateKey(new Date(dateOf(item)));
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}
