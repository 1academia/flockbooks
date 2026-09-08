-- FlockBooks — Sprint 7: performance pass, missing indexes.
-- None of these change behavior, only speed, as data grows.
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.

-- "Find my branch" (branch_staff filtered by user_id alone) is the very
-- first query on almost every dashboard page. Its only existing index is
-- unique(branch_id, user_id, role), which doesn't help a user_id-only
-- lookup since branch_id is the leading column.
create index if not exists branch_staff_user_id_idx on branch_staff(user_id);

-- acceptPendingInvites runs on every dashboard page load, filtered by
-- email alone. Its only existing index is unique(branch_id, email, role),
-- same problem as above.
create index if not exists pending_invites_email_idx on pending_invites(email);

-- outflows has no index at all beyond its primary key — every query
-- filters by branch_id (and usually expense_date too), so it's currently
-- a full table scan.
create index if not exists outflows_branch_date_idx on outflows(branch_id, expense_date);
