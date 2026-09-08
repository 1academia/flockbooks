// "Today", computed in the timezone every branch actually operates in —
// not the server process's own timezone. Vercel's serverless functions run
// in UTC regardless of project region, so `new Date()` + local-time getters
// (getDate/getDay/etc.) are wrong for roughly the first hour of each day in
// Nigeria: a Nov 1 8:30am WAT request is still Oct 31 in UTC. Every branch
// is in Nigeria, so this is fixed to Lagos rather than guessed per-request.
const APP_TIMEZONE = "Africa/Lagos";

// Today's calendar date (YYYY-MM-DD) as it currently reads in Nigeria.
export function todayInAppTimezone(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Day of week for "today" in Nigeria (0 = Sunday .. 6 = Saturday) — matches
// church_branches.midweek_service_day's own encoding.
export function todayDayOfWeekInAppTimezone(): number {
  const [y, m, d] = todayInAppTimezone().split("-").map(Number);
  // A local Date built from Y/M/D alone has no time-of-day component to go
  // wrong — getDay() on it is safe regardless of the host's own timezone.
  return new Date(y, m - 1, d).getDay();
}
