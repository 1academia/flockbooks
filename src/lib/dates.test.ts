import { describe, it, expect } from "vitest";
import { todayInAppTimezone, todayDayOfWeekInAppTimezone } from "./dates";

describe("todayInAppTimezone", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(todayInAppTimezone()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("matches the calendar date in Lagos right now — this is the whole point:", () => {
    // A regression test for the actual bug this function replaced: using
    // new Date() + UTC-based formatting (toISOString().slice(0,10)) reports
    // the wrong day for part of every Lagos day, since Vercel's serverless
    // functions run in UTC (Lagos is UTC+1) regardless of the server's own
    // clock. This asserts against the timezone-aware Intl calculation
    // directly, independent of whatever timezone this test happens to run in.
    const expected = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    expect(todayInAppTimezone()).toBe(expected);
  });
});

describe("todayDayOfWeekInAppTimezone", () => {
  it("returns a number 0-6", () => {
    const dow = todayDayOfWeekInAppTimezone();
    expect(dow).toBeGreaterThanOrEqual(0);
    expect(dow).toBeLessThanOrEqual(6);
  });

  it("agrees with the weekday implied by todayInAppTimezone()'s own date", () => {
    const [y, m, d] = todayInAppTimezone().split("-").map(Number);
    expect(todayDayOfWeekInAppTimezone()).toBe(new Date(y, m - 1, d).getDay());
  });
});
