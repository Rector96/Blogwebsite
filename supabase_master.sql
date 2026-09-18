-- ==============================================================================
-- FINSIGNAL MASTER SQL — paste ALL of this into Supabase → SQL Editor → RUN
-- Covers: articles (news), newsletter, sponsors (ads), click tracking, sales leads
-- Goal infrastructure: content + list + monetization measurement toward ~$1k/mo
-- ==============================================================================

-- Extensions (safe if already enabled)
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1) ARTICLES — RSS + AI enriched wire
-- -----------------------------------------------------------------------------
create table if not exists public.articles (
  id text primary key default gen_random_uuid()::text,
  original_url text not null unique,
  original_title text not null,
  original_description text not null default '',
  ai_hook_title text not null,
  ai_summary jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  source text not null default 'Financial Wire',
  image text not null default '',
  read_time text default '3 min read',
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists articles_timestamp_idx on public.articles (timestamp desc);
create index if not exists articles_tags_idx on public.articles using gin (tags);

alter table public.articles enable row level security;

drop policy if exists "Allow public read access to articles" on public.articles;
create policy "Allow public read access to articles"
  on public.articles for select using (true);

-- Service role / dashboard can write; anon cannot insert/update from browser

-- Seed (idempotent)
insert into public.articles (
  id, original_url, original_title, original_description, ai_hook_title,
  ai_summary, tags, source, image, read_time, timestamp
) values
(
  'supa-art-1',
  'https://www.marketwatch.com/personal-finance/banking/high-yield-cash-sweeps',
  'Treasury Yield Inversion Normalizes as Neobanks Shift Savings Sweep Yields to 5.15%',
  'Digital banking platforms leverage multi-bank custodial networks to deliver elevated cash yields.',
  'High-yield cash sweeps hit 5.15% as fintechs compete for uninvested deposits',
  '["Cash yields have detached from near-zero legacy savings rates.", "Multi-bank sweeps can extend deposit insurance while keeping liquidity."]'::jsonb,
  array['#Fintech','#Banking','#PersonalFinance'],
  'MarketWatch',
  'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
  '3 min read',
  now() - interval '15 minutes'
),
(
  'supa-art-2',
  'https://www.consumerfinance.gov/about-us/newsroom/cfpb-finalizes-personal-financial-data-rights/',
  'CFPB Rule 1033 Mandates Consumer Financial Data Portability Across Brokerages and Banks',
  'Open banking rules phase out screen-scraping in favor of secure bank-level APIs.',
  'Open banking Rule 1033: secure API portability aims to end password scraping',
  '["Regulators prefer signed bank tokens over shared credentials.", "Budget apps connect accounts with less friction when banks comply."]'::jsonb,
  array['#Fintech','#Regulation','#Banking'],
  'CFPB',
  'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80',
  '4 min read',
  now() - interval '45 minutes'
),
(
  'supa-art-3',
  'https://www.finextra.com/newsarticle/realtime-payroll-earned-wage-access',
  'Real-Time Payroll Integrations Displace Traditional Payday Lending with Earned Wage Access',
  'Payroll API bridges allow workers to draw accrued income between pay cycles.',
  'Earned wage access expands as employers plug into real-time payroll rails',
  '["Workers can access earned pay early when products are well designed.", "Employer integration is the distribution channel pure apps often lack."]'::jsonb,
  array['#Fintech','#Payments','#PersonalFinance'],
  'Finextra',
  'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80',
  '3 min read',
  now() - interval '90 minutes'
)
on conflict (original_url) do nothing;

-- -----------------------------------------------------------------------------
-- 2) NEWSLETTER — list growth (sell sponsorships later)
-- -----------------------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'web',
  status text not null default 'active' check (status in ('active', 'unsubscribed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists newsletter_subscribers_created_idx
  on public.newsletter_subscribers (created_at desc);

alter table public.newsletter_subscribers enable row level security;

drop policy if exists "Anyone can subscribe" on public.newsletter_subscribers;
create policy "Anyone can subscribe"
  on public.newsletter_subscribers
  for insert
  with check (true);

-- No public SELECT (protect the list)

-- -----------------------------------------------------------------------------
-- 3) SPONSORS — paid placements you control from Supabase
--    Edit rows in Table Editor; site can read active offers
-- -----------------------------------------------------------------------------
create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  sponsor_name text not null,
  headline text not null,
  why_matters jsonb not null default '[]'::jsonb,
  cta_text text not null default 'View offer',
  cta_url text not null,
  rate_highlight text not null default '',
  disclosure text not null default 'Sponsored · We may earn a commission',
  placement text not null default 'sidebar'
    check (placement in ('sidebar', 'in_feed', 'both')),
  active boolean not null default true,
  priority int not null default 100,
  starts_at timestamptz,
  ends_at timestamptz,
  monthly_fee_usd numeric(10,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sponsors_active_priority_idx
  on public.sponsors (active, priority);

alter table public.sponsors enable row level security;

drop policy if exists "Public read active sponsors" on public.sponsors;
create policy "Public read active sponsors"
  on public.sponsors
  for select
  using (
    active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

-- No demo sponsor rows are inserted. Create only real paid/approved sponsors through admin.\n\n-- -----------------------------------------------------------------------------
-- 4) CLICK EVENTS — measure which offers convert (for $1k optimization)
-- -----------------------------------------------------------------------------
create table if not exists public.sponsor_clicks (
  id bigint generated always as identity primary key,
  sponsor_id uuid references public.sponsors(id) on delete set null,
  sponsor_slug text,
  placement text,
  page_path text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists sponsor_clicks_created_idx
  on public.sponsor_clicks (created_at desc);
create index if not exists sponsor_clicks_slug_idx
  on public.sponsor_clicks (sponsor_slug);

alter table public.sponsor_clicks enable row level security;

drop policy if exists "Anyone can log clicks" on public.sponsor_clicks;
create policy "Anyone can log clicks"
  on public.sponsor_clicks
  for insert
  with check (true);

-- -----------------------------------------------------------------------------
-- 5) SALES LEADS — "Request media kit" / sponsor inquiries
-- -----------------------------------------------------------------------------
create table if not exists public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  company text,
  budget_usd numeric(12,2),
  message text,
  source text not null default 'media_kit',
  status text not null default 'new'
    check (status in ('new', 'contacted', 'won', 'lost')),
  created_at timestamptz not null default now()
);

create index if not exists sales_leads_created_idx
  on public.sales_leads (created_at desc);

alter table public.sales_leads enable row level security;

drop policy if exists "Anyone can submit sales lead" on public.sales_leads;
create policy "Anyone can submit sales lead"
  on public.sales_leads
  for insert
  with check (true);

-- -----------------------------------------------------------------------------
-- 6) Optional helper view — active sponsor inventory (dashboard)
-- -----------------------------------------------------------------------------
create or replace view public.v_active_sponsors as
select
  id, slug, sponsor_name, headline, cta_url, rate_highlight,
  placement, priority, monthly_fee_usd, starts_at, ends_at
from public.sponsors
where active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
order by priority asc, created_at desc;

-- Done. Next:
-- 1) Project Settings → API: copy URL + anon key to VITE_* env
-- 2) Service role key only on the Node server (cron ingest)
-- 3) cron-job.org → https://YOUR_HOST/api/cron/ingest?secret=CRON_SECRET
