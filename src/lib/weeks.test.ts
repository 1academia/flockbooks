import { describe, it, expect } from "vitest";
import { weekStartOf, weekSundayOf, weekLabel, depositDeadline, isPastDeadline, recentWeekStarts } from "./weeks";

describe("weekStartOf", () => {
  it("returns the same date for a Monday", () => {
    expect(weekStartOf("2026-09-07")).toBe("2026-09-07");
  });

  it("rolls a Sunday back to the Monday that starts its week", () => {
    expect(weekStartOf("2026-09-13")).toBe("2026-09-07");
  });

  it("rolls a mid-week Thursday back to that week's Monday", () => {
    expect(weekStartOf("2026-09-10")).toBe("2026-09-07");
  });

  it("handles a week that crosses a month boundary", () => {
    // Sept 29 2026 is a Tuesday, in the week starting Sept 28
    expect(weekStartOf("2026-09-29")).toBe("2026-09-28");
  });
});

describe("weekSundayOf", () => {
  it("is exactly 6 days after the Monday", () => {
    expect(weekSundayOf("2026-09-07")).toBe("2026-09-13");
  });
});

describe("weekLabel", () => {
  it("formats a week within one month as a single range", () => {
    expect(weekLabel("2026-09-07")).toBe("Sep 7–13, 2026");
  });

  it("formats a week that spans two months with both month names", () => {
    expect(weekLabel("2026-09-28")).toBe("Sep 28 – Oct 4, 2026");
  });
});

describe("depositDeadline", () => {
  it("defaults (Wednesday, dow 3) to the Wednesday after the week closes", () => {
    // Week Sept 7-13 (closes Sunday the 13th); Wednesday deadline = Sept 16
    expect(depositDeadline("2026-09-07", 3)).toBe("2026-09-16");
  });

  it("a dow of 0 (same Sunday the week closes) lands on the closing Sunday", () => {
    expect(depositDeadline("2026-09-07", 0)).toBe("2026-09-13");
  });
});

describe("isPastDeadline", () => {
  it("treats a deadline far in the past as past", () => {
    expect(isPastDeadline("2020-01-06", 3, "23:59:00")).toBe(true);
  });

  it("treats a deadline far in the future as not past", () => {
    expect(isPastDeadline("2099-01-05", 3, "23:59:00")).toBe(false);
  });
});

describe("recentWeekStarts", () => {
  it("returns exactly n weeks", () => {
    expect(recentWeekStarts(12, "2026-09-10")).toHaveLength(12);
  });

  it("the newest week is the Monday of the given 'today'", () => {
    expect(recentWeekStarts(1, "2026-09-10")[0]).toBe("2026-09-07");
  });

  it("returns Mondays, 7 days apart, newest first", () => {
    const weeks = recentWeekStarts(5, "2026-09-10");
    for (const w of weeks) {
      expect(weekStartOf(w)).toBe(w); // every entry is already a Monday
    }
    for (let i = 1; i < weeks.length; i++) {
      const prev = new Date(weeks[i - 1]);
      const cur = new Date(weeks[i]);
      expect((prev.getTime() - cur.getTime()) / 86_400_000).toBe(7);
    }
  });
});
