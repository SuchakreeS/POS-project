import { describe, expect, it } from "vitest";
import { addDays, bangkokDateKey, bangkokDayRange } from "./time";

describe("bangkokDateKey", () => {
  it("uses the Bangkok calendar day, not UTC", () => {
    expect(bangkokDateKey(new Date("2026-10-12T16:59:59.999Z"))).toBe("2026-10-12"); // 23:59:59 in Bangkok
    expect(bangkokDateKey(new Date("2026-10-12T17:00:00.000Z"))).toBe("2026-10-13"); // 00:00 in Bangkok
  });
});

describe("bangkokDayRange", () => {
  it("covers Bangkok midnight to midnight, as UTC instants", () => {
    const { start, end } = bangkokDayRange("2026-10-13");
    expect(start.toISOString()).toBe("2026-10-12T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-13T17:00:00.000Z");
  });

  it("round-trips with bangkokDateKey at the edges", () => {
    const { start, end } = bangkokDayRange("2026-12-31");
    expect(bangkokDateKey(start)).toBe("2026-12-31");
    expect(bangkokDateKey(new Date(end.getTime() - 1))).toBe("2026-12-31");
    expect(bangkokDateKey(end)).toBe("2027-01-01");
  });

  it.each(["2026-02-30", "2026-13-01", "26-10-12", "today"])("rejects %j", (day) => {
    expect(() => bangkokDayRange(day)).toThrow();
  });
});

describe("addDays", () => {
  it("moves across months and years", () => {
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});
