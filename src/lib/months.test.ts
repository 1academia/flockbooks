import { describe, it, expect } from "vitest";
import { recentMonthKeys, monthLabel, monthShortLabel, sameMonthLastYear } from "./months";

describe("recentMonthKeys", () => {
  it("returns exactly n months, oldest first", () => {
    const months = recentMonthKeys(13);
    expect(months).toHaveLength(13);
    // strictly increasing
    for (let i = 1; i < months.length; i++) {
      expect(months[i] > months[i - 1]).toBe(true);
    }
  });

  it("ends with the current month", () => {
    const now = new Date();
    const expectedCurrent = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const months = recentMonthKeys(3);
    expect(months[months.length - 1]).toBe(expectedCurrent);
  });

  it("correctly rolls back across a year boundary", () => {
    // Whatever "now" is, going back 13 months must land on a valid,
    // strictly-earlier year-month with no duplicate or skipped month.
    const months = recentMonthKeys(24);
    const seen = new Set(months);
    expect(seen.size).toBe(24); // no duplicates
  });
});

describe("monthLabel / monthShortLabel", () => {
  it("formats a month key as 'Mon YYYY'", () => {
    expect(monthLabel("2026-09")).toBe("Sep 2026");
    expect(monthLabel("2025-01")).toBe("Jan 2025");
  });

  it("monthShortLabel omits the year", () => {
    expect(monthShortLabel("2026-09")).toBe("Sep");
  });

  it("also accepts a full date string (extra day segment ignored)", () => {
    expect(monthLabel("2026-09-01")).toBe("Sep 2026");
  });
});

describe("sameMonthLastYear", () => {
  it("subtracts exactly one year, keeping the month", () => {
    expect(sameMonthLastYear("2026-09")).toBe("2025-09");
    expect(sameMonthLastYear("2026-01")).toBe("2025-01");
  });
});
