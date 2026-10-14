import {
  bangkokDateKey,
  bangkokDayRange,
  customerNameKey,
  type CustomerOverview,
} from "@pos/shared";

/*
 * Credit page list logic, on the client (a shop has tens to a few hundred credit customers).
 */

export type CreditView = "owing" | "all";
export type CreditSort = "highest" | "oldest";

export interface CreditFilter {
  search: string;
  view: CreditView;
  sort: CreditSort;
}

function matches(customer: CustomerOverview, search: string) {
  const q = search.trim();
  if (!q) return true;
  return (
    customerNameKey(customer.name).includes(customerNameKey(q)) ||
    (customer.phone?.includes(q) ?? false)
  );
}

/** Rows for the table and the chip counts (counts follow the search). */
export function filterCustomers(customers: readonly CustomerOverview[], filter: CreditFilter) {
  const found = customers.filter((customer) => matches(customer, filter.search));
  const owing = found.filter((customer) => customer.balance > 0);
  const rows = [...(filter.view === "owing" ? owing : found)].sort((a, b) => {
    if (filter.sort === "oldest") {
      // Oldest debt first; people who owe nothing go last.
      const ta = a.oldestUnpaidAt ?? "9999";
      const tb = b.oldestUnpaidAt ?? "9999";
      return ta.localeCompare(tb) || b.balance - a.balance;
    }
    return b.balance - a.balance || a.name.localeCompare(b.name, "th");
  });
  return { rows, counts: { owing: owing.length, all: found.length } };
}

/** Whole shop days since `iso` (Bangkok calendar), e.g. 0 = today. */
export function daysSince(iso: string, now: Date = new Date()): number {
  const from = bangkokDayRange(bangkokDateKey(new Date(iso))).start.getTime();
  const to = bangkokDayRange(bangkokDateKey(now)).start.getTime();
  return Math.round((to - from) / 86_400_000);
}

/** "Today", "Yesterday", "12 days". */
export function ageLabel(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days`;
}

/** Debts this old get an amber badge (plan.md → Credit page). */
export const OLD_DEBT_DAYS = 30;

// Thai vowels written before their consonant (เ แ โ ใ ไ) — skip them so "เอก" shows "อ", not "เ".
const LEADING_VOWELS = /^[เ-ไ]+/u;
const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });

/** One letter for the avatar circle: first grapheme, uppercased ("somchai" → "S", "เอก" → "อ"). */
export function initialOf(name: string): string {
  const trimmed = name.trim().replace(LEADING_VOWELS, "");
  const first = graphemes.segment(trimmed)[Symbol.iterator]().next().value?.segment ?? "?";
  return first.toLocaleUpperCase("en");
}
