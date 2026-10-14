import type { CustomerOverview } from "@pos/shared";
import { describe, expect, it } from "vitest";
import { ageLabel, daysSince, filterCustomers, initialOf } from "./credit-view";

const c = (
  name: string,
  balance: number,
  oldestUnpaidAt: string | null,
  phone: string | null = null,
): CustomerOverview => ({
  id: name,
  name,
  phone,
  balance,
  oldestUnpaidAt,
});

const customers = [
  c("Somchai", 78000, "2026-09-01T05:00:00Z", "0812345678"),
  c("Mali", 12000, "2026-10-10T05:00:00Z"),
  c("Ploy", 0, null),
  c("Big Joe", 150000, "2026-10-01T05:00:00Z"),
];

describe("filterCustomers", () => {
  it("shows who owes, highest first, with counts", () => {
    const { rows, counts } = filterCustomers(customers, {
      search: "",
      view: "owing",
      sort: "highest",
    });
    expect(rows.map((r) => r.name)).toEqual(["Big Joe", "Somchai", "Mali"]);
    expect(counts).toEqual({ owing: 3, all: 4 });
  });

  it("sorts by oldest debt, people who owe nothing last", () => {
    const { rows } = filterCustomers(customers, { search: "", view: "all", sort: "oldest" });
    expect(rows.map((r) => r.name)).toEqual(["Somchai", "Big Joe", "Mali", "Ploy"]);
  });

  it("searches name (any case) or phone", () => {
    expect(
      filterCustomers(customers, { search: "SOM", view: "all", sort: "highest" }).rows.map(
        (r) => r.name,
      ),
    ).toEqual(["Somchai"]);
    expect(
      filterCustomers(customers, { search: "0812", view: "all", sort: "highest" }).rows,
    ).toHaveLength(1);
  });
});

describe("debt age", () => {
  const now = new Date("2026-10-14T03:00:00Z"); // 10:00 Bangkok, 14 Oct
  it("counts Bangkok calendar days", () => {
    expect(daysSince("2026-10-14T00:30:00Z", now)).toBe(0);
    expect(daysSince("2026-10-13T16:59:00Z", now)).toBe(1); // 23:59 on the 13th in Bangkok
    expect(daysSince("2026-09-14T05:00:00Z", now)).toBe(30);
  });

  it("labels the age", () => {
    expect([ageLabel(0), ageLabel(1), ageLabel(12)]).toEqual(["Today", "Yesterday", "12 days"]);
  });
});

describe("initialOf", () => {
  it("takes the first letter, uppercased", () => {
    expect(initialOf("  somchai")).toBe("S");
    expect(initialOf("สมชาย")).toBe("ส");
  });

  it("skips Thai leading vowels and keeps combining marks together", () => {
    expect(initialOf("เอก")).toBe("อ");
    expect(initialOf("ไก่")).toBe("ก่");
  });

  it("falls back to ? for an empty name", () => {
    expect(initialOf("   ")).toBe("?");
  });
});
