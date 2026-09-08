-- FlockBooks — Sprint 3.1: phone number on invites, so a WhatsApp/SMS
-- notification can go out alongside the invite email.
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.

alter table pending_invites
  add column if not exists phone text;
