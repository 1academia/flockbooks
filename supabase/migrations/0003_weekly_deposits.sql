-- FlockBooks — Sprint 3: recording the weekly cash deposit.
-- weekly_cash_deposits itself (and its RLS) already exists from 0001_init.sql —
-- this just adds the evidence photo + who/when recorded it, same pattern as
-- service_records' paper_form_photo_path.
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.

alter table weekly_cash_deposits
  add column if not exists teller_slip_photo_path text,
  add column if not exists deposited_by uuid references app_users(id),
  add column if not exists deposited_at timestamptz;
