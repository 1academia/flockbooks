// Month-key ("YYYY-MM") helpers for analytics — UTC-based, same approach as
// weeks.ts, so a server's own timezone can never shift a month boundary.

// The last n month-keys ending with the current month, oldest first.
export function recentMonthKeys(n: number): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

// "Sep 2026" for a "2026-09" key.
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

// Just the "Sep" part, for tight chart labels.
export function monthShortLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

// The same calendar month, one year earlier — "2026-09" -> "2025-09".
export function sameMonthLastYear(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `${Number(y) - 1}-${m}`;
}
