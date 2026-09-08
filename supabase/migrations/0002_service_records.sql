-- FlockBooks — Sprint 2: service entry (Cash Analysis + Record of Activities)
-- and its sign-off chain: Counters -> Accountant -> Admin -> Assembly Pastor
-- -> Regional Overseer.
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- (Run 0001_init.sql first if you haven't already.)

-- ---------------------------------------------------------------------
-- Funds — each branch counts cash separately per fund (Tithe, Offering,
-- etc). Every branch starts with 4 defaults; a Sub Admin can add/retire
-- more from the branch page.
-- ---------------------------------------------------------------------

create table if not exists branch_funds (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references church_branches(id) on delete cascade,
  name text not null,
  sort_order smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (branch_id, name)
);

create or replace function seed_default_funds() returns trigger as $$
begin
  insert into branch_funds (branch_id, name, sort_order) values
    (new.id, 'Tithe', 1),
    (new.id, 'Offering', 2),
    (new.id, 'Special Offering', 3),
    (new.id, 'Donations/Pledges', 4);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists church_branches_seed_funds on church_branches;
create trigger church_branches_seed_funds
  after insert on church_branches
  for each row execute function seed_default_funds();

-- Backfill: give any branch created before this migration its 4 defaults too,
-- but only if it has none yet (never overwrites a branch that already has funds).
insert into branch_funds (branch_id, name, sort_order)
select b.id, f.name, f.sort_order
from church_branches b
cross join (values ('Tithe', 1), ('Offering', 2), ('Special Offering', 3), ('Donations/Pledges', 4)) as f(name, sort_order)
where not exists (select 1 from branch_funds where branch_id = b.id);

-- ---------------------------------------------------------------------
-- Service records — one row per branch per service date (Sunday or the
-- branch's chosen mid-week day). Holds the Record-of-Activities fields;
-- grand_total is the sum of that service's cash counts, kept in sync by
-- the app after it writes the cash-count rows below.
-- ---------------------------------------------------------------------

create table if not exists service_records (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references church_branches(id) on delete cascade,
  service_date date not null,
  service_type text not null check (service_type in ('sunday', 'midweek')),
  minister text,
  sermon_title text,
  male integer not null default 0,
  female integer not null default 0,
  children integer not null default 0,
  teenage integer not null default 0,
  attendance_total integer generated always as (male + female + children + teenage) stored,
  grand_total numeric(14,2) not null default 0,
  -- Path inside the private "service-photos" storage bucket, not a public
  -- URL — a photo of the paper Cash Analysis/Record of Activities sheet,
  -- kept as evidence the hard copy was actually filled in. Never used to
  -- fill in the typed numbers above.
  paper_form_photo_path text,
  counter1_name text,
  counter2_name text,
  counter3_name text,
  submitted_by uuid references app_users(id),
  status text not null default 'waiting_on_accountant' check (
    status in ('waiting_on_accountant', 'waiting_on_admin', 'waiting_on_assembly_pastor', 'waiting_on_regional_overseer', 'closed')
  ),
  created_at timestamptz not null default now(),
  unique (branch_id, service_date)
);

create table if not exists service_cash_counts (
  id uuid primary key default gen_random_uuid(),
  service_record_id uuid not null references service_records(id) on delete cascade,
  fund_id uuid references branch_funds(id) on delete set null,
  -- Captured at entry time so a later fund rename never rewrites history.
  fund_name text not null,
  q1000 integer not null default 0,
  q500 integer not null default 0,
  q200 integer not null default 0,
  q100 integer not null default 0,
  q50 integer not null default 0,
  q20 integer not null default 0,
  q10 integer not null default 0,
  coins numeric(14,2) not null default 0,
  total numeric(14,2) generated always as (
    q1000 * 1000 + q500 * 500 + q200 * 200 + q100 * 100 + q50 * 50 + q20 * 20 + q10 * 10 + coins
  ) stored,
  created_at timestamptz not null default now(),
  unique (service_record_id, fund_name)
);

-- One row per service record. counters_signed_at is set the moment the
-- record is submitted (the counters signing the paper form in person is
-- what the submission itself represents); each later stage is a timestamp
-- + who signed, left null until their turn.
create table if not exists service_signoffs (
  id uuid primary key default gen_random_uuid(),
  service_record_id uuid not null references service_records(id) on delete cascade unique,
  counters_signed_at timestamptz not null default now(),
  accountant_signed_at timestamptz,
  accountant_signed_by uuid references app_users(id),
  admin_signed_at timestamptz,
  admin_signed_by uuid references app_users(id),
  assembly_pastor_signed_at timestamptz,
  assembly_pastor_signed_by uuid references app_users(id),
  regional_overseer_signed_at timestamptz,
  regional_overseer_signed_by uuid references app_users(id)
);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table branch_funds enable row level security;
alter table service_records enable row level security;
alter table service_cash_counts enable row level security;
alter table service_signoffs enable row level security;

create policy branch_funds_read on branch_funds for select
  using (is_super_admin() or branch_id in (select my_branch_ids()));
create policy branch_funds_write on branch_funds for all
  using (is_super_admin() or branch_id in (
    select branch_id from branch_staff where user_id = auth.uid() and role = 'sub_admin'
  ))
  with check (is_super_admin() or branch_id in (
    select branch_id from branch_staff where user_id = auth.uid() and role = 'sub_admin'
  ));

create policy service_records_all on service_records for all
  using (is_super_admin() or branch_id in (select my_branch_ids()))
  with check (is_super_admin() or branch_id in (select my_branch_ids()));

create policy service_cash_counts_all on service_cash_counts for all
  using (is_super_admin() or service_record_id in (
    select id from service_records where branch_id in (select my_branch_ids())
  ))
  with check (is_super_admin() or service_record_id in (
    select id from service_records where branch_id in (select my_branch_ids())
  ));

create policy service_signoffs_all on service_signoffs for all
  using (is_super_admin() or service_record_id in (
    select id from service_records where branch_id in (select my_branch_ids())
  ))
  with check (is_super_admin() or service_record_id in (
    select id from service_records where branch_id in (select my_branch_ids())
  ));
