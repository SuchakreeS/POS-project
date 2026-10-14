import { describe, expect, it } from "vitest";
import {
  formatDayLabel,
  formatDayTime,
  formatTime,
  groupByDay,
  presetOf,
  presetRange,
  rangeLabel,
} from "./datetime";

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

describe("formatDayTime", () => {
  it("joins the day label and the time", () => {
    expect(formatDayTime("2026-10-13T07:32:00Z", now)).toBe("Today · 14:32");
    expect(formatDayTime("2026-10-01T02:05:00Z", now)).toBe("Thu, 1 Oct 2026 · 09:05");
  });
});

describe("date ranges", () => {
  it("builds the presets from the Bangkok day", () => {
    expect(presetRange("today", now)).toEqual({ from: "2026-10-13", to: "2026-10-13" });
    expect(presetRange("yesterday", now)).toEqual({ from: "2026-10-12", to: "2026-10-12" });
    expect(presetRange("last7", now)).toEqual({ from: "2026-10-07", to: "2026-10-13" });
    expect(presetRange("thisMonth", now)).toEqual({ from: "2026-10-01", to: "2026-10-13" });
    // 00:30 on 1 Nov in Bangkok is still 31 Oct in UTC: "This month" must be November.
    expect(presetRange("thisMonth", new Date("2026-10-31T17:30:00Z"))).toEqual({
      from: "2026-11-01",
      to: "2026-11-01",
    });
  });

  it("names a range by its preset, else by its dates", () => {
    expect(presetOf({ from: "2026-10-07", to: "2026-10-13" }, now)).toBe("last7");
    expect(rangeLabel({ from: "2026-10-13", to: "2026-10-13" }, now)).toBe("Today");
    expect(rangeLabel({ from: "2026-10-05", to: "2026-10-05" }, now)).toBe("5 Oct");
    expect(rangeLabel({ from: "2026-09-28", to: "2026-10-02" }, now)).toBe("28 Sept – 2 Oct");
    expect(rangeLabel({ from: "2025-12-30", to: "2026-01-02" }, now)).toBe("30 Dec 2025 – 2 Jan");
  });
});
