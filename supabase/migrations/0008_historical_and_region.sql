-- FlockBooks — Sprint 9: historical backfill + region-wide staff visibility.
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.

-- ---------------------------------------------------------------------
-- Historical monthly totals — for periods before FlockBooks was in use,
-- so Analytics can compare them (e.g. January 2025 vs January 2026).
-- Entered as one total per fund per month, plus one expense total per
-- month — not individual services or receipts, since that level of
-- historical detail usually doesn't exist digitally.
-- ---------------------------------------------------------------------

create table if not exists historical_monthly_totals (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references church_branches(id) on delete cascade,
  month date not null, -- always the 1st of the month
  kind text not null check (kind in ('income', 'expense')),
  fund_id uuid references branch_funds(id) on delete set null,
  fund_name text, -- captured at entry time; null for the expense row
  amount numeric(14,2) not null,
  recorded_by uuid references app_users(id),
  recorded_at timestamptz not null default now()
);

create index if not exists historical_totals_branch_month_idx on historical_monthly_totals(branch_id, month);

alter table historical_monthly_totals enable row level security;

create policy historical_totals_read on historical_monthly_totals for select
  using (is_super_admin() or branch_id in (select my_branch_ids()));
create policy historical_totals_write on historical_monthly_totals for all
  using (is_super_admin() or branch_id in (
    select branch_id from branch_staff where user_id = auth.uid() and role = 'sub_admin'
  ))
  with check (is_super_admin() or branch_id in (
    select branch_id from branch_staff where user_id = auth.uid() and role = 'sub_admin'
  ));

-- ---------------------------------------------------------------------
-- Region-wide staff visibility for Sub Admins — a branch's Pastor can
-- now also see contact info (name, email, phone) for staff at other
-- branches in their own region, not just their own branch. Everyone
-- else's access is unchanged: Super Admin already saw everyone, and
-- regular staff still only see their own branch.
-- ---------------------------------------------------------------------

create or replace function my_region_ids() returns setof uuid as $$
  select distinct cb.region_id
  from branch_staff bs
  join church_branches cb on cb.id = bs.branch_id
  where bs.user_id = auth.uid() and bs.role = 'sub_admin' and cb.region_id is not null;
$$ language sql security definer stable;

create policy users_read_region on app_users for select
  using (
    id in (
      select bs.user_id from branch_staff bs
      join church_branches cb on cb.id = bs.branch_id
      where cb.region_id in (select my_region_ids())
    )
  );
