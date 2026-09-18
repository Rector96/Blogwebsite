-- RWDNEWS Phase 4: admin analytics, NGN sponsorship payments, editorial controls and audit log
create extension if not exists "pgcrypto";

-- Event analytics collected through the RWDNEWS tracking endpoint.
create table if not exists public.rwdnews_events (
  id bigint generated always as identity primary key,
  event_name text not null,
  article_id text,
  article_url text,
  placement text,
  page_path text,
  referrer text,
  session_id text,
  source text,
  country text,
  city text,
  device text,
  browser text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now()
);
create index if not exists rwdnews_events_created_idx on public.rwdnews_events(created_at desc);
create index if not exists rwdnews_events_source_idx on public.rwdnews_events(source);
create index if not exists rwdnews_events_country_idx on public.rwdnews_events(country);
create index if not exists rwdnews_events_article_idx on public.rwdnews_events(article_id);
alter table public.rwdnews_events enable row level security;
drop policy if exists "Anyone can log events" on public.rwdnews_events;
create policy "Anyone can log events" on public.rwdnews_events for insert with check (true);

-- Editorial controls for live news.
alter table public.articles add column if not exists editorial_status text not null default 'published';
alter table public.articles add column if not exists featured boolean not null default false;
alter table public.articles add column if not exists pinned boolean not null default false;
create index if not exists articles_editorial_status_idx on public.articles(editorial_status);
create index if not exists articles_featured_idx on public.articles(featured, pinned);

-- NGN sponsor packages and Paystack transactions.
create table if not exists public.sponsor_payments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  package_code text not null,
  package_name text not null,
  amount_naira numeric(12,2) not null check (amount_naira > 0),
  amount_kobo bigint not null check (amount_kobo > 0),
  email text not null,
  name text,
  company text,
  headline text,
  cta_url text,
  placement text,
  duration_days integer not null default 30,
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled','refunded')),
  paystack_status text,
  paystack_transaction_id text,
  sponsor_id uuid references public.sponsors(id) on delete set null,
  paid_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sponsor_payments_created_idx on public.sponsor_payments(created_at desc);
create index if not exists sponsor_payments_status_idx on public.sponsor_payments(status);
create index if not exists sponsor_payments_email_idx on public.sponsor_payments(email);
alter table public.sponsor_payments enable row level security;

-- Admin audit trail. No public policies: service role only.
create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);
alter table public.admin_audit_logs enable row level security;

-- Remove the old demo inventory. Only genuine paid/approved campaigns should be active.
update public.sponsors
set active = false,
    updated_at = now()
where slug in ('partner-cash-demo', 'partner-invest-demo');

-- Convert legacy dollar field to a neutral NGN amount for the admin.
alter table public.sponsors add column if not exists monthly_fee_naira numeric(12,2);
update public.sponsors set monthly_fee_naira = coalesce(monthly_fee_naira, monthly_fee_usd * 1600) where monthly_fee_naira is null and monthly_fee_usd is not null;

-- Useful admin view.
create or replace view public.v_rwdnews_daily_traffic as
select
  date_trunc('day', created_at)::date as day,
  count(*) filter (where event_name = 'page_view') as page_views,
  count(distinct session_id) filter (where event_name = 'page_view') as unique_sessions
from public.rwdnews_events
group by 1
order by 1 desc;
