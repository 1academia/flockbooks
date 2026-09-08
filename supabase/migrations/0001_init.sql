-- FlockBooks — foundational schema (Sprint 0 + Sprint 1)
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Regions & Church Branches
-- ---------------------------------------------------------------------

create table if not exists regions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists church_branches (
  id uuid primary key default gen_random_uuid(),
  region_id uuid references regions(id) on delete set null,
  name text not null,
  address text,
  closest_bus_stop text,
  -- Sub Admin picks which weekday carries the mid-week service (0=Sunday..6=Saturday).
  -- Sunday service always exists; this is ONLY for the second, mid-week one.
  midweek_service_day smallint check (midweek_service_day between 0 and 6),
  -- Every branch verifies its cash deposits against an uploaded bank statement,
  -- due weekly by this weekday + time. Default: Wednesday (3) 23:59.
  statement_deadline_dow smallint not null default 3 check (statement_deadline_dow between 0 and 6),
  statement_deadline_time time not null default '23:59:00',
  created_by uuid, -- references app_users(id), set after app_users exists (see below)
  created_via text not null default 'super_admin' check (created_via in ('super_admin', 'self_serve')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------

-- One row per person, extending Supabase's built-in auth.users.
create table if not exists app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text,
  -- Platform-level role. 'staff' covers Accountant / Admin / Assembly Pastor /
  -- Regional Overseer — their specific job lives in branch_staff.role instead,
  -- since the same person could in principle help at more than one branch.
  platform_role text not null check (platform_role in ('super_admin', 'sub_admin', 'staff')),
  created_at timestamptz not null default now()
);

alter table church_branches
  add constraint church_branches_created_by_fkey
  foreign key (created_by) references app_users(id) on delete set null;

-- Which branch(es) a person works at, and in what capacity.
-- A Pastor's row here has role = 'sub_admin'.
create table if not exists branch_staff (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references church_branches(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  role text not null check (role in ('sub_admin', 'accountant', 'admin', 'assembly_pastor', 'regional_overseer')),
  invited_by uuid references app_users(id),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (branch_id, user_id, role)
);

-- Pending invites: a person doesn't have an auth.users row until they first
-- log in with the code sent to this email, so invites are tracked separately
-- and turned into a real branch_staff row on first login.
create table if not exists pending_invites (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references church_branches(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('sub_admin', 'accountant', 'admin', 'assembly_pastor', 'regional_overseer')),
  invited_by uuid references app_users(id),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (branch_id, email, role)
);

-- ---------------------------------------------------------------------
-- Weekly cash deposit — ALWAYS covers both Sunday service and the
-- mid-week service together, one row per branch per week.
-- ---------------------------------------------------------------------

create table if not exists weekly_cash_deposits (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references church_branches(id) on delete cascade,
  week_start date not null, -- the Monday that starts this week
  amount numeric(14,2) not null default 0,
  teller_attached boolean not null default false,
  teller_attached_at timestamptz,
  -- The account statement that proves this deposit actually happened,
  -- due by the branch's statement_deadline_dow/time (Wednesday 23:59 by default).
  statement_uploaded boolean not null default false,
  statement_uploaded_at timestamptz,
  status text not null default 'open' check (status in ('open', 'overdue', 'verified')),
  created_at timestamptz not null default now(),
  unique (branch_id, week_start)
);

-- ---------------------------------------------------------------------
-- Row Level Security — a branch can never see another branch's data,
-- and platform_role gates the platform-wide screens.
-- ---------------------------------------------------------------------

alter table regions enable row level security;
alter table church_branches enable row level security;
alter table app_users enable row level security;
alter table branch_staff enable row level security;
alter table pending_invites enable row level security;
alter table weekly_cash_deposits enable row level security;

create or replace function is_super_admin() returns boolean as $$
  select exists (
    select 1 from app_users where id = auth.uid() and platform_role = 'super_admin'
  );
$$ language sql security definer stable;

create or replace function my_branch_ids() returns setof uuid as $$
  select branch_id from branch_staff where user_id = auth.uid();
$$ language sql security definer stable;

-- Regions: everyone signed in can read; only Super Admin writes.
create policy regions_read on regions for select using (auth.uid() is not null);
create policy regions_write on regions for all using (is_super_admin()) with check (is_super_admin());

-- Church branches: Super Admin sees/edits everything; branch staff see their
-- own branch; any signed-in user can INSERT (that's the self-serve path —
-- creating a branch is how a Pastor becomes its Sub Admin).
create policy branches_read on church_branches for select
  using (is_super_admin() or id in (select my_branch_ids()));
create policy branches_insert on church_branches for insert
  with check (auth.uid() is not null);
create policy branches_update on church_branches for update
  using (is_super_admin() or id in (
    select branch_id from branch_staff where user_id = auth.uid() and role = 'sub_admin'
  ));

-- app_users: everyone can read their own row and the people at their branch(es);
-- Super Admin reads everyone.
create policy users_read on app_users for select
  using (
    id = auth.uid()
    or is_super_admin()
    or id in (
      select bs.user_id from branch_staff bs where bs.branch_id in (select my_branch_ids())
    )
  );
create policy users_insert_self on app_users for insert with check (id = auth.uid());

-- branch_staff: Super Admin sees all; a branch's own staff list is visible
-- to everyone at that branch; Sub Admin (and Super Admin) can add people to
-- their own branch.
create policy staff_read on branch_staff for select
  using (is_super_admin() or branch_id in (select my_branch_ids()));
create policy staff_write on branch_staff for insert
  with check (
    is_super_admin()
    or branch_id in (select branch_id from branch_staff where user_id = auth.uid() and role = 'sub_admin')
  );

create policy invites_read on pending_invites for select
  using (is_super_admin() or branch_id in (select my_branch_ids()));
create policy invites_write on pending_invites for insert
  with check (
    is_super_admin()
    or branch_id in (select branch_id from branch_staff where user_id = auth.uid() and role = 'sub_admin')
  );

create policy deposits_read on weekly_cash_deposits for select
  using (is_super_admin() or branch_id in (select my_branch_ids()));
create policy deposits_write on weekly_cash_deposits for all
  using (is_super_admin() or branch_id in (select my_branch_ids()))
  with check (is_super_admin() or branch_id in (select my_branch_ids()));
