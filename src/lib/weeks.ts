// Date-only math for weekly cash deposits. Every date here is a plain
// YYYY-MM-DD string (what Postgres `date` columns give us), and all
// arithmetic happens in UTC so the server's own timezone can never shift a
// date by a day.

function toUTCDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}
function addDays(dateStr: string, days: number): string {
  const d = toUTCDate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateStr(d);
}

// The Monday (YYYY-MM-DD) that starts the ISO week containing this date —
// matches weekly_cash_deposits.week_start's own definition ("the Monday
// that starts this week").
export function weekStartOf(dateStr: string): string {
  const d = toUTCDate(dateStr);
  const isoDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // Mon=1 .. Sun=7
  return addDays(dateStr, -(isoDay - 1));
}

// The Sunday that closes a week starting on weekStart — the church's Sunday
// service for that week always falls on this date.
export function weekSundayOf(weekStart: string): string {
  return addDays(weekStart, 6);
}

// A short "Sep 1–7, 2026" (or "Sep 29 – Oct 5, 2026") label for a week.
export function weekLabel(weekStart: string): string {
  const start = toUTCDate(weekStart);
  const end = toUTCDate(weekSundayOf(weekStart));
  const monthFmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  if (sameMonth) return `${monthFmt(start)} ${start.getUTCDate()}–${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  return `${monthFmt(start)} ${start.getUTCDate()} – ${monthFmt(end)} ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
}

// The account-statement deadline for a week: deadlineDow counted forward
// from the Sunday that closes the week (0=that same Sunday .. 6=the
// following Saturday). The branch's default, Wednesday (3), lands 3 days
// after the closing Sunday — the Wednesday of the week that follows.
export function depositDeadline(weekStart: string, deadlineDow: number): string {
  return addDays(weekSundayOf(weekStart), deadlineDow);
}

// Soft "is this week's deposit overdue" check — good enough for a status
// badge; the app doesn't otherwise track a per-branch timezone.
export function isPastDeadline(weekStart: string, deadlineDow: number, deadlineTime: string): boolean {
  const deadlineDate = depositDeadline(weekStart, deadlineDow);
  const deadline = new Date(`${deadlineDate}T${deadlineTime}Z`);
  return Date.now() > deadline.getTime();
}

// The most recent n week-starts, newest first — for the deposits list.
// Takes "today" as a parameter (from todayInAppTimezone()) rather than
// computing it from the server's own clock — every branch is in Nigeria,
// and the server process itself may not be.
export function recentWeekStarts(n: number, today: string): string[] {
  const thisWeek = weekStartOf(today);
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(addDays(thisWeek, -7 * i));
  return out;
}
