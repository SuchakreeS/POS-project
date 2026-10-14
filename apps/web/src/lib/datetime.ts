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

/** "Today · 14:32", "Yesterday · 09:05", "Mon, 12 Oct 2026 · 14:32". */
export function formatDayTime(iso: string, now: Date = new Date()): string {
  return `${formatDayLabel(bangkokDateKey(new Date(iso)), now)} · ${formatTime(iso)}`;
}

// ---------- Date ranges (Orders, Reports) ----------

export interface DateRange {
  from: DateKey;
  to: DateKey;
}

export const DATE_PRESETS = ["today", "yesterday", "last7", "thisMonth"] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  thisMonth: "This month",
};

export function presetRange(preset: DatePreset, now: Date = new Date()): DateRange {
  const today = bangkokDateKey(now);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const yesterday = addDays(today, -1);
      return { from: yesterday, to: yesterday };
    }
    case "last7":
      return { from: addDays(today, -6), to: today };
    case "thisMonth":
      return { from: `${today.slice(0, 8)}01`, to: today };
  }
}

/** The preset a range matches, if any (so the chip says "Last 7 days" rather than two dates). */
export function presetOf(range: DateRange, now: Date = new Date()): DatePreset | null {
  return (
    DATE_PRESETS.find((preset) => {
      const candidate = presetRange(preset, now);
      return candidate.from === range.from && candidate.to === range.to;
    }) ?? null
  );
}

const shortDayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TIMEZONE,
  day: "numeric",
  month: "short",
});
const shortDayYearFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "12 Oct", or "12 Oct 2025" outside the current year. */
function shortDay(day: DateKey, now: Date): string {
  const sameYear = day.slice(0, 4) === bangkokDateKey(now).slice(0, 4);
  return (sameYear ? shortDayFormat : shortDayYearFormat).format(new Date(`${day}T12:00:00+07:00`));
}

/** Chip label: "Today", "Last 7 days", "12 Oct", "1 Oct – 14 Oct". */
export function rangeLabel(range: DateRange, now: Date = new Date()): string {
  const preset = presetOf(range, now);
  if (preset) return DATE_PRESET_LABELS[preset];
  if (range.from === range.to) return shortDay(range.from, now);
  return `${shortDay(range.from, now)} – ${shortDay(range.to, now)}`;
}
