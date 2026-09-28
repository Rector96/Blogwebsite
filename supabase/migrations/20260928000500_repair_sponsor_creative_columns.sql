-- Repair migration for sponsor creative fields.
-- Safe to run even if the earlier creative migration was already applied.
alter table if exists public.sponsor_payments
  add column if not exists creative_mode text not null default 'upload',
  add column if not exists creative_url text,
  add column if not exists logo_url text,
  add column if not exists creative_notes text,
  add column if not exists design_requested boolean not null default false;

alter table if exists public.sponsors
  add column if not exists creative_url text,
  add column if not exists logo_url text,
  add column if not exists creative_alt text;

create index if not exists sponsor_payments_design_idx
  on public.sponsor_payments(design_requested,status,created_at desc);
