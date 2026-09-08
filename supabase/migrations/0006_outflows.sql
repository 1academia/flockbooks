-- FlockBooks — Sprint 5: Outflow / Expenses.
-- One row per expense, always with evidence (a receipt or payment voucher
-- photo) and who paid it out — same evidence-first pattern as service
-- records and the weekly deposit's teller slip.
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.

create table if not exists outflows (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references church_branches(id) on delete cascade,
  fund_id uuid references branch_funds(id) on delete set null,
  expense_date date not null,
  amount numeric(14,2) not null,
  paid_to text not null,
  reason text not null,
  payment_method text not null default 'cash' check (payment_method in ('cash', 'transfer', 'cheque', 'other')),
  receipt_photo_path text,
  recorded_by uuid references app_users(id),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table outflows enable row level security;

-- Same visibility rule as everything else branch-scoped: Super Admin sees
-- all, a branch's own staff see (and record) their branch's outflows.
create policy outflows_read on outflows for select
  using (is_super_admin() or branch_id in (select my_branch_ids()));
create policy outflows_write on outflows for all
  using (is_super_admin() or branch_id in (select my_branch_ids()))
  with check (is_super_admin() or branch_id in (select my_branch_ids()));
