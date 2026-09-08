# FlockBooks — Setup (Sprint 0 + Sprint 1 + Sprint 2)

This gets the app running for real: a live database, a live website, and real
emails. Everything below is free at this size except your `flockbooks.net`
domain, which you already own. Takes about 25–30 minutes, done once.

## 1. Create your Supabase project (the database)

1. Go to **supabase.com** → **Start your project** → sign in with GitHub or
   email.
2. Click **New project**. Name it `flockbooks`, pick a strong database
   password (save it somewhere), pick the region closest to Nigeria (e.g.
   `eu-west` or `eu-central`), click **Create new project**. Takes about 2
   minutes to spin up.
3. Once it's ready, in the left sidebar click **SQL Editor** → **New query**.
4. Open the file `supabase/migrations/0001_init.sql` from this project,
   copy everything in it, paste it into the SQL Editor, and click **Run**.
   This creates every table FlockBooks needs.
5. In the left sidebar, click **Project Settings** (gear icon) → **API Keys**
   → the **"Legacy anon, service_role API keys"** tab (Supabase's newer key
   names don't match what the app expects). You'll need three values from
   this page in step 4 of section 3 below:
   - **Project URL**
   - **anon** key
   - **service_role** key (click "Reveal" — keep this one secret)

## 2. Connect Resend as your email sender (SMTP)

Supabase now requires a connected email sender before its login-code email
can be customized, so set this up before touching the template.

1. In Resend (resend.com), make sure **flockbooks.net** shows as
   **Verified** under **Domains**. If it's still pending, wait for DNS to
   propagate before continuing (usually minutes, sometimes a few hours).
2. In Resend, find your **SMTP** details — host, port, username, and
   password (the password is your Resend API key). Copy all four.
3. In Supabase: **Authentication** → **Emails** → **SMTP Settings** tab.
   Enter the host, port, username, and password from Resend, and set the
   sender name/email to `FlockBooks <no-reply@flockbooks.net>`. Save.
4. Now go to **Templates** tab → **Magic Link**. Select all the text in the
   body box, delete it, and paste this in:
   ```
   <h2>Your FlockBooks sign-in code</h2>
   <p>Enter this code to sign in: <strong>{{ .Token }}</strong></p>
   <p>This code expires shortly, so use it right away.</p>
   ```
   Click **Save**.

## 3. Create your Resend API key (for the app itself)

1. In Resend: **API Keys** → **Create API Key** → name it `flockbooks` →
   copy the key (starts with `re_`). You'll only see it once.

## 4. Connect everything together

1. In this project folder, copy `.env.example` to a new file named
   `.env.local`.
2. Fill in every value:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from
     Supabase step 1.5 above.
   - `SUPABASE_SERVICE_ROLE_KEY` — the service_role key, same place. Never
     share this one or put it in anything public.
   - `RESEND_API_KEY` — from section 3 above.
   - `RESEND_FROM_EMAIL` — already set to
     `"FlockBooks <no-reply@flockbooks.net>"`, leave as is.
   - `SUPER_ADMIN_BOOTSTRAP_EMAIL` — **your own email**, exactly as you'll
     sign in with. This is the one email allowed to become the very first
     Super Admin with no invite needed. Every person after you gets added
     from inside the app.

## 5. Run it locally to try it

In a terminal, inside this folder:
```
npm install
npm run dev
```
Open `http://localhost:3000`. Sign in with your bootstrap email, check that
inbox for the 6-digit code, enter it — you should land on the Super Admin
dashboard.

## 6. Put it on the internet (Vercel) — one click

No GitHub, no copy-pasting seven environment variables by hand. Just:

1. Double-click **deploy.bat** in this folder.
2. The very first time, a browser tab opens asking you to sign in to
   Vercel — do that, then come back to the black window and press Enter if
   it asks. It'll also ask a couple of quick setup questions (pick your
   **Safe Network** team when asked which scope/account) — accepting the
   defaults is fine.
3. It then uploads every value from your `.env.local` to Vercel automatically
   and deploys. A couple of minutes later it prints your live address, like
   `flockbooks.vercel.app`.
4. To use your own domain: in your Vercel project → **Settings** →
   **Domains** → add `flockbooks.net` (it's already in your Vercel account,
   so this is usually instant).
5. Once you know your final address, update `NEXT_PUBLIC_SITE_URL` in
   `.env.local` to match it (e.g. `https://flockbooks.net`), then
   double-click **deploy.bat** again — this is what makes links inside
   invite emails point to the right place.

Every time you want to push a change live afterwards, it's the same one
step: double-click **deploy.bat**.

## 7. Sprint 2 — already set up for you

This one's done — no action needed. For the record, Sprint 2 added:

- The `supabase/migrations/0002_service_records.sql` migration (already run
  against your live database) — the tables for service records, per-fund
  cash counts, and the sign-off chain.
- A **service-photos** storage bucket in Supabase (already created, kept
  private — the app fetches evidence photos through a time-limited link,
  never a public one).

All you need to do to get Sprint 2 live is the usual: double-click
**deploy.bat**.

## 8. Sprint 3 — already set up for you

Also done, no action needed. Sprint 3 added the
`supabase/migrations/0003_weekly_deposits.sql` migration (already run
against your live database) — three extra columns on the
`weekly_cash_deposits` table that already existed. As before, all you need
is **deploy.bat**.

## 9. Sprint 3.1 — invites got better, and a phone field was added

Already run against your live database
(`supabase/migrations/0004_invite_phone.sql`) — one new `phone` column on
invites. As before, all you need is **deploy.bat**.

- Re-inviting the same email no longer crashes — it just resends.
- The branch page now shows everyone still waiting to accept, with a Cancel
  button, and a Resend button that appears once an invite has waited 24
  hours unanswered.
- If a Sub Admin ends up with two different people invited (or accepted) to
  the same role — two Accountants, say — they're asked to confirm before
  sending, and get a heads-up email either way.
- The invite form has an optional phone number field, for a WhatsApp/SMS
  copy of the invite alongside the email — see section 10 below to turn
  this on. Until you do, leaving the phone field blank (or leaving Twilio
  unconfigured) is completely fine — invites work by email either way.

## 10. WhatsApp/SMS invites (optional) — connect Twilio

Skip this section entirely if you're happy with invites going out by email
only — everything above works without it.

1. Go to **twilio.com** → sign up → you land on the **Console**, which
   shows your **Account SID** and **Auth Token** right away. Copy both.
2. For SMS: **Phone Numbers** → **Buy a number** (Twilio gives a small free
   trial credit) → copy that number, e.g. `+15017122661`.
3. For WhatsApp: the fastest way to test is Twilio's free **WhatsApp
   Sandbox** — **Messaging** → **Try it out** → **Send a WhatsApp message**.
   It gives you a sandbox number (usually `+14155238886`) and a join code;
   send that join code from your own WhatsApp to that number once, and your
   number can then receive sandbox messages. (Moving to a real WhatsApp
   sender for production later means applying for WhatsApp Business
   approval inside Twilio — the sandbox is fine to start with.)
4. In `.env.local`, fill in:
   - `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` — from step 1.
   - `TWILIO_SMS_FROM` — the number from step 2, e.g. `+15017122661`.
   - `TWILIO_WHATSAPP_FROM` — the sandbox (or approved) number from step 3,
     written as `whatsapp:+14155238886` (note the `whatsapp:` prefix).
5. Double-click **deploy.bat** as usual. From then on, any invite with a
   phone number filled in also goes out by WhatsApp and SMS.

## 11. Sprint 4 — already set up for you

Also done, no action needed. Sprint 4 added the
`supabase/migrations/0005_bank_statement.sql` migration (already run
against your live database) — the columns needed to check a week's deposit
against its bank statement, plus a new `mismatch` status alongside the
existing open/overdue/verified ones. As before, all you need is
**deploy.bat**.

- Opening a recorded week now shows a **Bank statement** section: type in
  what the statement shows for that week, attach a photo or PDF of it, and
  it's compared against what was recorded as deposited.
- A match marks the week **Verified**; a mismatch flags it clearly, with
  both amounts shown, so it doesn't get missed.
- Correcting the deposit amount later automatically re-checks it against
  whatever statement is already on file, so a "Verified" week can't quietly
  go stale.

## 12. Sprint 5 — already set up for you

Also done, no action needed. Sprint 5 added the
`supabase/migrations/0006_outflows.sql` migration (already run against
your live database) — a new `outflows` table for tracking money paid out.
As before, all you need is **deploy.bat**.

- New **Outflow / Expenses** page (linked from the branch dashboard):
  record every expense — date, amount, who it was paid to, the reason,
  payment method, and which fund it came from (optional) — with a required
  photo of the receipt or payment voucher as evidence.
- Shows a running total for the current month, and the full list with each
  expense's receipt viewable on demand.
- Any of the branch's own staff can record or delete an expense (same
  permission level as recording a deposit).

## 13. Sprint 6 — already set up for you

Also done, no action needed — Sprint 6 needed no new database changes, just
a new page. As before, all you need is **deploy.bat**.

- New **Analytics** page (linked from the branch dashboard): a 12-month
  chart of income against expenses, a year-on-year comparison of this
  month against the same month last year for both, and a breakdown of
  this month's income by fund.
- Built entirely from records already in the system — service records,
  weekly deposits, and outflows — so it fills in on its own as more weeks
  and months are recorded.

## What's built so far (Sprint 0 through Sprint 6)

- Email + one-time code sign-in — no passwords anywhere.
- Super Admin dashboard: create a Church Branch, create a Pastor (who
  becomes that branch's Sub Admin automatically), see every branch.
- Sub Admin dashboard: create your own new Branch (added to Super Admin's
  list automatically, with a heads-up email — no approval needed), set
  which weekday carries your mid-week service, add Accountant / Admin /
  Assembly Pastor to your branch.
- Every invite goes out as a real email through Resend.
- Each branch's weekly account-statement deadline (Wednesday 11:59pm by
  default) is stored and shown.

- Service Records — one entry form covers both the Cash Analysis (per-fund
  denomination counts) and the Record of Activities (attendance, minister,
  sermon) for a Sunday or mid-week service, with a required photo of the
  paper form as evidence, and a review step before it saves.
- The sign-off chain that follows: Counters (in person, at submission) →
  Accountant → Admin → Assembly Pastor → Regional Overseer, each notified
  by email when it's their turn, each stage enforced in order.
- A branch's funds (Tithe, Offering, etc.) are editable from the branch
  page — add one, or retire one without losing past records that used it.

- Weekly Cash Deposits — one record per week, always covering Sunday and
  mid-week together: the app totals that week's service records for you,
  you enter what was actually deposited (with a required photo of the
  teller slip), and it's saved against that week going forward.
- Bank statement matching — check a recorded deposit against the actual
  statement; a week now shows as Not Yet Recorded, Overdue, Recorded,
  Verified (matches the statement), or Mismatch (doesn't).

- Outflow / Expenses — every expense paid out, with a receipt or voucher
  photo required as evidence, a monthly running total, and a fund tag when
  it applies to one.
- Analytics — a 12-month income vs. expenses trend, year-on-year comparison
  for the current month, and this month's income broken down by fund.

That's the full original roadmap — every sprint is now built and deployed.

## 14. Sprint 7 — a rough-edges pass (already set up for you)

Not a new feature — a pass over the whole app fixing four things that
would otherwise get more noticeable as more branches and staff use it.
The `supabase/migrations/0007_indexes.sql` migration (already run
against your live database) is the only database change; everything
else is app code. As before, all you need is **deploy.bat**.

- A friendly error screen everywhere something goes wrong, instead of a
  technical Next.js error page — shows the actual reason (e.g. "Amount
  must be greater than zero") with a Try Again button.
- A proper "Page not found" screen for stale or mistyped links.
- Form fields no longer trigger iOS Safari's auto-zoom when tapped — a
  very common phone-browser annoyance, now fixed everywhere at once.
- The cash-count entry grid (the most-used form in the app — every
  Sunday and mid-week service) now stacks to 2 columns on narrow phones
  instead of always cramming 4 into one row.
- Three missing database indexes added — the two hottest lookups in the
  whole app (finding your branch, checking for pending invites, both run
  on nearly every page load) and the outflows table, which had no index
  at all beyond its ID. These only matter as data grows, but they're
  free to have now.
- The Outflow/Expenses list page no longer generates a signed receipt
  link for every expense on every visit — only when you actually click
  "Receipt" — since most are never opened.

## 15. Sprint 8 — already set up for you

Small fixes from feedback, no database changes. As before, all you need
is **deploy.bat**.

- Every inner page (Weekly Deposits, Outflow/Expenses, Service Records,
  Analytics, a single week or service, My Profile) now has a "&larr; back"
  link at the top, not just the browser's own back button.
- The sign-in code screen no longer claims the code is always 6 digits —
  it can be 6 or 8 depending on how it was sent, and both work; the
  screen also now has a link to go back and use a different email or
  request a new code.
- The "Everyone at this branch" list now shows each person's phone
  number too, when they've added one to their profile (alongside the
  email address it already showed).

## 16. Sprint 9 — already set up for you

The `supabase/migrations/0008_historical_and_region.sql` migration
(already run against your live database) is the only database change.
As before, all you need is **deploy.bat**.

- **Records from before FlockBooks** — a new page (linked from Analytics)
  where a branch's Sub Admin can enter a past month's totals by hand: one
  income total per fund, one expense total, no per-service detail or
  receipts required. This lets Analytics compare, say, January 2025
  against January 2026 even though FlockBooks wasn't in use back then.
  Re-saving a month replaces what was there, so it's safe to correct.
- **Analytics now has a month picker** — the year-over-year comparison
  at the top isn't locked to "this month" anymore; pick any month (e.g.
  January) and it compares that month against the same month the
  previous year, pulling from both live records and anything entered on
  the historical page above.
- **Region-wide staff visibility for Sub Admins** — a branch's Pastor can
  now see name, email, and phone for staff at other branches in their
  own region, not just their own branch, in a new section at the bottom
  of the branch dashboard. Nobody else's access changed — Super Admin
  already saw everyone, and regular staff still only see their own
  branch.

## 17. Sprint 10 — a CTO fix-it pass (already set up for you)

Behind-the-scenes engineering work — nothing changes visually, and there
was only one small database change (adding a `superseded_at` column,
already run against your live database). As before, all you need is
**deploy.bat**. What changed:

- **A real automated test suite** — 52 tests now run before every
  deploy check (`npm run verify`), covering the app's core business
  logic: date/timezone handling, week and month math, sign-off role
  rules, and the authorization checks below. This is what actually
  caught the next item.
- **A genuine timezone bug, found and fixed** — three places that
  compute "today's date" (the default date on a new service record, the
  default date on a new expense, and which week Deposits shows as
  "current") were quietly wrong for part of every day, because Vercel's
  servers run in UTC while the app is used in Lagos (UTC+1). Fixed by
  computing "today" explicitly in the Africa/Lagos timezone everywhere,
  instead of relying on the server's own clock.
- **One place for "are you allowed to do this?"** — the authorization
  checks that were scattered and duplicated across seven different
  files (who can sign off a stage, who can enter historical totals, who
  can invite staff, and so on) are now one shared, tested module. Same
  rules as before, same error messages — just written once and checked
  by tests instead of copy-pasted and hoped-correct.
- **Historical totals are no longer overwritten, they're superseded** —
  correcting a past month on the "Records from before FlockBooks" page
  used to delete the old numbers outright. It now marks them superseded
  and keeps them in the database, so there's a recoverable trail behind
  every correction to a financial figure — the same standard the rest
  of the app's financial records are held to.
- **Email alerts for server errors** — if a page throws an unexpected
  error, every Super Admin now gets an email with what broke and where,
  instead of it only showing up in Vercel's logs where nobody's
  watching. Ordinary "you're not allowed to do that" messages are
  deliberately excluded — only genuine bugs alert.
- **A preview deploy, separate from the live site** — running
  **deploy-preview.bat** now builds and publishes to a fresh, non-public
  URL (printed at the end) instead of flockbooks.net, so a change can be
  clicked through for real before going live. It shares the same
  database as production, so it's for checking that a change *works*,
  not for entering test data.

Two things from this pass are deliberately not done, because they cost
money or need your sign-off rather than mine: the project has no
database backups at all today (Supabase's free plan doesn't include
them — Pro does, at a monthly cost), and the project isn't connected to
a GitHub repository (which would unlock real per-change previews and
automatic checks, but means granting Vercel access to a GitHub account).
Worth deciding on both when you're ready.
