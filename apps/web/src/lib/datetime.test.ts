import { describe, expect, it } from "vitest";
import { formatDayLabel, formatTime, groupByDay } from "./datetime";

const now = new Date("2026-10-13T05:00:00Z"); // 12:00 in Bangkok, Tue 13 Oct

describe("formatTime", () => {
  it("shows Bangkok time, 24-hour", () => {
    expect(formatTime("2026-10-13T07:32:00Z")).toBe("14:32");
    expect(formatTime("2026-10-12T17:05:00Z")).toBe("00:05");
  });
});

describe("formatDayLabel", () => {
  it("says Today and Yesterday, then the date", () => {
    expect(formatDayLabel("2026-10-13", now)).toBe("Today");
    expect(formatDayLabel("2026-10-12", now)).toBe("Yesterday");
    expect(formatDayLabel("2026-10-01", now)).toBe("Thu, 1 Oct 2026");
  });
});

describe("groupByDay", () => {
  it("groups by Bangkok day, so 23:30 Bangkok stays on its own day", () => {
    const items = [
      { at: "2026-10-13T02:00:00Z" }, // 09:00 on the 13th
      { at: "2026-10-12T16:30:00Z" }, // 23:30 on the 12th
      { at: "2026-10-12T01:00:00Z" }, // 08:00 on the 12th
    ];
    expect(groupByDay(items, (item) => item.at).map((g) => [g.day, g.items.length])).toEqual([
      ["2026-10-13", 1],
      ["2026-10-12", 2],
    ]);
  });
});
