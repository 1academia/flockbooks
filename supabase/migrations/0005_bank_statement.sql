-- FlockBooks — Sprint 4: matching a deposit against the uploaded bank
-- statement. weekly_cash_deposits already had statement_uploaded /
-- statement_uploaded_at / status from 0001_init.sql — this adds what was
-- missing (the evidence file, the amount actually read off the statement,
-- and who did it) plus a 'mismatch' status for when the two don't agree.
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.

alter table weekly_cash_deposits
  add column if not exists statement_photo_path text,
  add column if not exists statement_amount numeric(14,2),
  add column if not exists statement_uploaded_by uuid references app_users(id);

alter table weekly_cash_deposits drop constraint if exists weekly_cash_deposits_status_check;
alter table weekly_cash_deposits
  add constraint weekly_cash_deposits_status_check
  check (status in ('open', 'overdue', 'verified', 'mismatch'));
