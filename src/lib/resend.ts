import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || "FlockBooks <no-reply@flockbooks.net>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function shell(title: string, body: string) {
  return `<div style="font-family:'Public Sans',Arial,sans-serif;background:#EDF1F8;padding:32px 16px;">
    <div style="max-width:480px;margin:0 auto;background:#FBFCFE;border:1px solid #DCE1EA;border-radius:12px;padding:28px 26px;">
      <p style="font-family:Georgia,serif;font-size:19px;font-weight:600;color:#16223F;margin:0 0 4px;">FlockBooks</p>
      <h1 style="font-size:17px;color:#1B2233;margin:18px 0 10px;">${title}</h1>
      <div style="font-size:14px;color:#3A4257;line-height:1.6;">${body}</div>
    </div>
  </div>`;
}

export async function sendInviteEmail(opts: {
  to: string;
  fullName: string;
  role: string;
  branchName: string;
  invitedByName: string;
}) {
  const roleLabel = opts.role.replace(/_/g, " ");
  const html = shell(
    "You've been added to FlockBooks",
    `<p>Hi ${opts.fullName},</p>
     <p><b>${opts.invitedByName}</b> has added you as <b>${roleLabel}</b> at
     <b>${opts.branchName}</b>.</p>
     <p>Sign in with this email address — FlockBooks will send you a one-time code,
     no password to remember.</p>
     <p><a href="${SITE}/login?email=${encodeURIComponent(opts.to)}"
       style="display:inline-block;margin-top:10px;background:#16223F;color:#fff;
       padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
       Sign in to FlockBooks</a></p>`
  );
  return resend.emails.send({ from: FROM, to: opts.to, subject: "You've been added to FlockBooks", html });
}

export async function sendDuplicateRoleAlertEmail(opts: {
  to: string;
  branchName: string;
  roleLabel: string;
  people: string[]; // names/emails currently holding or invited to this role
}) {
  const list = opts.people.map((p) => `<li>${p}</li>`).join("");
  const html = shell(
    `You now have ${opts.people.length} people down as ${opts.roleLabel}`,
    `<p>At <b>${opts.branchName}</b>, more than one person is now either accepted or
     waiting to accept the <b>${opts.roleLabel}</b> role:</p>
     <ul style="margin:8px 0;padding-left:20px;">${list}</ul>
     <p>If that's not what you meant, you can cancel one of the invites from your
     branch page.</p>
     <p><a href="${SITE}/dashboard/branch" style="color:#16223F;font-weight:600;">
       Open your branch page &rarr;</a></p>`
  );
  return resend.emails.send({
    from: FROM, to: opts.to,
    subject: `Heads up: ${opts.people.length} people down as ${opts.roleLabel} at ${opts.branchName}`, html,
  });
}

export async function sendNewBranchNoticeEmail(opts: {
  to: string;
  branchName: string;
  region: string;
  createdByName: string;
}) {
  const html = shell(
    "A new church branch was just created",
    `<p><b>${opts.createdByName}</b> created a new branch, <b>${opts.branchName}</b>
     (${opts.region}), directly from their Sub Admin dashboard — no approval was
     needed, this is just a heads-up.</p>
     <p><a href="${SITE}/dashboard/super-admin" style="color:#16223F;font-weight:600;">
       View it in the Super Admin dashboard &rarr;</a></p>`
  );
  return resend.emails.send({ from: FROM, to: opts.to, subject: `New branch: ${opts.branchName}`, html });
}

// Sent to every Super Admin when instrumentation.ts's onRequestError hook
// catches an unhandled server error — this is the closest thing this app
// has to error monitoring, given there's no separate service (Sentry etc.)
// wired up. Without this, a broken page only gets noticed if a user
// happens to report it.
export async function sendServerErrorAlertEmail(opts: {
  to: string;
  message: string;
  path?: string;
}) {
  const html = shell(
    "A server error was just caught",
    `<p>FlockBooks caught an unhandled error${opts.path ? ` on <code>${opts.path}</code>` : ""}:</p>
     <p style="font-family:'IBM Plex Mono',monospace;background:#EDF1F8;padding:10px 12px;
       border-radius:6px;font-size:13px;color:#1B2233;white-space:pre-wrap;">${opts.message}</p>
     <p style="color:#5B6478;font-size:12.5px;">This is an automatic alert with no other monitoring behind
     it — check the Vercel function logs for the full stack trace if this doesn't look like an
     ordinary validation message.</p>`
  );
  return resend.emails.send({ from: FROM, to: opts.to, subject: "FlockBooks — server error alert", html });
}

export async function sendSignoffAlertEmail(opts: {
  to: string;
  branchName: string;
  serviceDate: string;
  grandTotal: number;
  roleLabel: string;
  serviceRecordId: string;
}) {
  const html = shell(
    "A record is waiting for your sign-off",
    `<p>The service record for <b>${opts.branchName}</b> on <b>${opts.serviceDate}</b>
     (Grand Total: &#8358;${opts.grandTotal.toLocaleString()}) is ready for your
     sign-off as <b>${opts.roleLabel}</b>.</p>
     <p><a href="${SITE}/dashboard/branch/services/${opts.serviceRecordId}"
       style="display:inline-block;margin-top:10px;background:#16223F;color:#fff;
       padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
       Review &amp; sign &rarr;</a></p>`
  );
  return resend.emails.send({
    from: FROM, to: opts.to,
    subject: `Sign-off needed — ${opts.branchName} ${opts.serviceDate}`, html,
  });
}

export async function sendStatementDeadlineReminderEmail(opts: {
  to: string;
  branchName: string;
  weekStart: string;
  deadline: string;
}) {
  const html = shell(
    "Account statement due soon",
    `<p><b>${opts.branchName}</b>'s account statement for the week of
     ${opts.weekStart} is due by <b>${opts.deadline}</b>, to verify this week's
     cash deposit.</p>
     <p><a href="${SITE}/dashboard/branch" style="color:#16223F;font-weight:600;">
       Upload it now &rarr;</a></p>`
  );
  return resend.emails.send({ from: FROM, to: opts.to, subject: `Statement due: ${opts.branchName}`, html });
}
