-- RWDNEWS global monetization + analytics foundation
-- Safe to run after the original RWDNEWS/FINSIGNAL schema.
-- No demo sponsors, payments, subscribers, leads or analytics rows are inserted.

create extension if not exists "pgcrypto";

-- Existing sponsors already use monthly_fee_usd in the base schema.
alter table if exists public.sponsors
  add column if not exists monthly_fee_naira numeric(12,2),
  add column if not exists currency text not null default 'USD',
  add column if not exists campaign_type text not null default 'direct',
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists disclosure_required boolean not null default true;

do $$ begin
  alter table public.sponsors drop constraint if exists sponsors_currency_check;
  alter table public.sponsors add constraint sponsors_currency_check check (currency in ('USD','NGN'));
exception when undefined_table then null; end $$;

-- Preserve any legacy USD amount while making the currency explicit.
update public.sponsors
set currency = 'USD'
where currency is null or currency = '';

-- Analytics/events. Visitor IPs are not stored; the tracker only uses Netlify geo + browser/device fields.
create table if not exists public.rwdnews_events (
  id bigint generated always as identity primary key,
  event_name text not null,
  article_id text,
  article_url text,
  placement text,
  page_path text not null default '/',
  source text,
  country text,
  city text,
  device text,
  browser text,
  referrer text,
  session_id text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now()
);

create index if not exists rwdnews_events_created_idx on public.rwdnews_events(created_at desc);
create index if not exists rwdnews_events_event_idx on public.rwdnews_events(event_name, created_at desc);
create index if not exists rwdnews_events_country_idx on public.rwdnews_events(country, created_at desc);
create index if not exists rwdnews_events_city_idx on public.rwdnews_events(city, created_at desc);
create index if not exists rwdnews_events_source_idx on public.rwdnews_events(source, created_at desc);
create index if not exists rwdnews_events_session_idx on public.rwdnews_events(session_id, created_at desc);

alter table public.rwdnews_events enable row level security;
drop policy if exists "Public can record RWDNEWS events" on public.rwdnews_events;
create policy "Public can record RWDNEWS events"
  on public.rwdnews_events for insert
  with check (true);

-- Direct sponsorship/payment ledger.
create table if not exists public.sponsor_payments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  package_code text not null,
  package_name text not null,
  currency text not null default 'USD' check (currency in ('USD','NGN')),
  amount numeric(12,2) not null check (amount > 0),
  amount_subunit bigint not null check (amount_subunit > 0),
  amount_usd numeric(12,2),
  amount_naira numeric(12,2),
  amount_kobo bigint,
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
  paystack_currency text,
  sponsor_id uuid references public.sponsors(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sponsor_payments_created_idx on public.sponsor_payments(created_at desc);
create index if not exists sponsor_payments_status_idx on public.sponsor_payments(status, created_at desc);
create index if not exists sponsor_payments_sponsor_idx on public.sponsor_payments(sponsor_id);

alter table public.sponsor_payments enable row level security;

-- Existing legacy columns may be present from an earlier attempt. Add the new canonical fields without deleting them.
alter table if exists public.sponsor_payments
  add column if not exists currency text,
  add column if not exists amount numeric(12,2),
  add column if not exists amount_subunit bigint,
  add column if not exists amount_usd numeric(12,2),
  add column if not exists amount_naira numeric(12,2),
  add column if not exists amount_kobo bigint,
  add column if not exists paystack_currency text,
  add column if not exists updated_at timestamptz not null default now();

update public.sponsor_payments
set currency = coalesce(currency, 'NGN'),
    amount_naira = coalesce(amount_naira, amount_kobo / 100.0),
    amount = coalesce(amount, amount_naira),
    amount_subunit = coalesce(amount_subunit, amount_kobo)
where currency is null or amount is null or amount_subunit is null;

-- Audit trail for admin/payment actions.
create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_action_idx on public.admin_audit_logs(action, created_at desc);

alter table public.admin_audit_logs enable row level security;

-- Editorial controls used by the admin dashboard.
alter table if exists public.articles
  add column if not exists editorial_status text not null default 'published',
  add column if not exists featured boolean not null default false,
  add column if not exists pinned boolean not null default false;

do $$ begin
  alter table public.articles drop constraint if exists articles_editorial_status_check;
  alter table public.articles add constraint articles_editorial_status_check
    check (editorial_status in ('published','hidden','archived'));
exception when undefined_table then null; end $$;

create index if not exists articles_editorial_idx on public.articles(editorial_status, timestamp desc);
create index if not exists articles_featured_idx on public.articles(featured, timestamp desc);
create index if not exists articles_pinned_idx on public.articles(pinned, timestamp desc);

-- Sponsor clicks: create only if missing; the existing table is kept compatible.
create table if not exists public.sponsor_clicks (
  id bigint generated always as identity primary key,
  sponsor_id uuid references public.sponsors(id) on delete set null,
  sponsor_slug text,
  placement text,
  page_path text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists sponsor_clicks_created_idx on public.sponsor_clicks(created_at desc);
create index if not exists sponsor_clicks_slug_idx on public.sponsor_clicks(sponsor_slug);

alter table public.sponsor_clicks enable row level security;
drop policy if exists "Anyone can log clicks" on public.sponsor_clicks;
create policy "Anyone can log clicks" on public.sponsor_clicks for insert with check (true);

-- Newsletter is kept private except for signup.
alter table if exists public.newsletter_subscribers enable row level security;
drop policy if exists "Anyone can subscribe" on public.newsletter_subscribers;
create policy "Anyone can subscribe" on public.newsletter_subscribers for insert with check (true);

-- Leads are public-write only; admin reads through the service role.
alter table if exists public.sales_leads enable row level security;
drop policy if exists "Anyone can submit sales lead" on public.sales_leads;
create policy "Anyone can submit sales lead" on public.sales_leads for insert with check (true);

-- Public sponsor reads remain limited to active campaigns.
alter table if exists public.sponsors enable row level security;
drop policy if exists "Public read active sponsors" on public.sponsors;
create policy "Public read active sponsors" on public.sponsors
for select using (
  active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

-- Global rate card. These are USD list prices, not an exchange-rate conversion.
-- NGN prices remain available as the local Nigeria rate card.
create table if not exists public.sponsor_rate_cards (
  package_code text primary key,
  package_name text not null,
  currency text not null check (currency in ('USD','NGN')),
  amount numeric(12,2) not null check (amount > 0),
  placement text not null,
  duration_days integer not null default 30,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists sponsor_rate_cards_currency_idx on public.sponsor_rate_cards(currency, active);

alter table public.sponsor_rate_cards enable row level security;
drop policy if exists "Public read active sponsor rate cards" on public.sponsor_rate_cards;
create policy "Public read active sponsor rate cards" on public.sponsor_rate_cards
for select using (active = true);

insert into public.sponsor_rate_cards(package_code,package_name,currency,amount,placement,duration_days)
values
('sidebar','Sidebar Sponsor','USD',75,'sidebar',30),
('in_feed','In-feed Sponsor','USD',100,'in_feed',30),
('homepage','Homepage Featured Sponsor','USD',150,'both',30),
('homepage_sidebar','Homepage + Sidebar','USD',200,'both',30),
('newsletter','Newsletter Sponsor','USD',75,'newsletter',30),
('sponsored_story','Sponsored Article / Briefing','USD',150,'in_feed',30),
('premium','Premium Monthly Package','USD',300,'both',30),
('sidebar','Sidebar Sponsor','NGN',75000,'sidebar',30),
('in_feed','In-feed Sponsor','NGN',100000,'in_feed',30),
('homepage','Homepage Featured Sponsor','NGN',150000,'both',30),
('homepage_sidebar','Homepage + Sidebar','NGN',200000,'both',30),
('newsletter','Newsletter Sponsor','NGN',75000,'newsletter',30),
('sponsored_story','Sponsored Article / Briefing','NGN',150000,'in_feed',30),
('premium','Premium Monthly Package','NGN',300000,'both',30)
on conflict (package_code) do nothing;

-- Replace the rate-card primary key so USD and NGN can coexist.
alter table public.sponsor_rate_cards drop constraint if exists sponsor_rate_cards_pkey;
alter table public.sponsor_rate_cards add primary key (package_code, currency);

-- The insert above can safely be rerun after the composite key exists.
insert into public.sponsor_rate_cards(package_code,package_name,currency,amount,placement,duration_days)
values
('sidebar','Sidebar Sponsor','USD',75,'sidebar',30),
('in_feed','In-feed Sponsor','USD',100,'in_feed',30),
('homepage','Homepage Featured Sponsor','USD',150,'both',30),
('homepage_sidebar','Homepage + Sidebar','USD',200,'both',30),
('newsletter','Newsletter Sponsor','USD',75,'newsletter',30),
('sponsored_story','Sponsored Article / Briefing','USD',150,'in_feed',30),
('premium','Premium Monthly Package','USD',300,'both',30),
('sidebar','Sidebar Sponsor','NGN',75000,'sidebar',30),
('in_feed','In-feed Sponsor','NGN',100000,'in_feed',30),
('homepage','Homepage Featured Sponsor','NGN',150000,'both',30),
('homepage_sidebar','Homepage + Sidebar','NGN',200000,'both',30),
('newsletter','Newsletter Sponsor','NGN',75000,'newsletter',30),
('sponsored_story','Sponsored Article / Briefing','NGN',150000,'in_feed',30),
('premium','Premium Monthly Package','NGN',300000,'both',30)
on conflict (package_code,currency) do update
set package_name=excluded.package_name, amount=excluded.amount,
    placement=excluded.placement, duration_days=excluded.duration_days,
    updated_at=now();

-- Helpful public view for the live rate card.
create or replace view public.v_active_sponsor_rate_cards as
select package_code, package_name, currency, amount, placement, duration_days
from public.sponsor_rate_cards
where active = true
order by currency, amount;

