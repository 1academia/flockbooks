// Next.js auto-detects this file at the project root and calls
// onRequestError for any error thrown in a Server Component, Route
// Handler, or Server Action that isn't already caught. Before this file
// existed, that only ever reached Vercel's function logs — nobody was
// watching them, so a broken page in production was silent until a user
// happened to mention it. This is a deliberately lightweight stand-in for
// real error monitoring (Sentry etc.), not a replacement for one: it has
// no dashboard, no trends, and — since it keeps its throttle state in
// memory — no dedup across separate server instances or cold starts.
//
// AuthzError (src/lib/authz.ts) is excluded on purpose: "you're not
// allowed to do that" is the authorization system working correctly, not
// something broken, and alerting on every one of those would bury the
// alerts that actually matter under routine noise.

const ALERT_THROTTLE_MS = 15 * 60 * 1000; // at most one alert per distinct message per 15 min, per warm instance
const recentlyAlerted = new Map<string, number>();

function shouldAlert(message: string): boolean {
  const now = Date.now();
  const last = recentlyAlerted.get(message);
  if (last && now - last < ALERT_THROTTLE_MS) return false;
  recentlyAlerted.set(message, now);
  // Keep the map from growing unbounded over a long-lived instance.
  if (recentlyAlerted.size > 200) {
    const cutoff = now - ALERT_THROTTLE_MS;
    for (const [key, at] of recentlyAlerted) if (at < cutoff) recentlyAlerted.delete(key);
  }
  return true;
}

export async function onRequestError(
  err: unknown,
  request: { path: string }
) {
  try {
    const { AuthzError } = await import("@/lib/authz");
    if (err instanceof AuthzError) return;

    const message = err instanceof Error ? err.message : String(err);
    if (!shouldAlert(`${request.path}:${message}`)) return;

    const { createAdminClient } = await import("@/lib/supabase/server");
    const { sendServerErrorAlertEmail } = await import("@/lib/resend");
    const admin = createAdminClient();
    const { data: superAdmins } = await admin.from("app_users").select("email").eq("platform_role", "super_admin");
    for (const sa of superAdmins || []) {
      await sendServerErrorAlertEmail({ to: sa.email, message, path: request.path });
    }
  } catch {
    // Alerting must never itself throw — that would replace one silent
    // failure with a different silent failure, worse off than before.
  }
}
