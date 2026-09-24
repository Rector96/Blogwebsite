-- Kora primary payment gateway for RWDNEWS sponsorship payments.
alter table if exists public.sponsor_payments
  add column if not exists payment_provider text not null default 'paystack',
  add column if not exists provider_status text,
  add column if not exists provider_transaction_id text,
  add column if not exists provider_currency text;

alter table if exists public.sponsor_payments
  drop constraint if exists sponsor_payments_payment_provider_check;

alter table if exists public.sponsor_payments
  add constraint sponsor_payments_payment_provider_check
  check (payment_provider in ('kora','paystack'));

create index if not exists sponsor_payments_provider_idx
  on public.sponsor_payments(payment_provider, status, created_at desc);
