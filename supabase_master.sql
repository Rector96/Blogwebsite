-- ==============================================================================
-- RWDNEWS MASTER SQL — paste ALL of this into Supabase → SQL Editor → RUN
-- Covers: source-backed articles, newsletter, sponsors, click tracking, sales leads and product analytics
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

-- -----------------------------------------------------------------------------
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



-- -----------------------------------------------------------------------------
-- 7) RWDNEWS ENGAGEMENT EVENTS — privacy-light product analytics
--    No names, emails, IP addresses, or ad identifiers are stored.
-- -----------------------------------------------------------------------------
create table if not exists public.rwdnews_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in (
    'article_open', 'article_share', 'article_save',
    'newsletter_signup', 'sponsor_click', 'advertise_open'
  )),
  article_id text,
  article_url text,
  placement text,
  page_path text,
  referrer text,
  session_id text,
  created_at timestamptz not null default now()
);

create index if not exists rwdnews_events_created_idx
  on public.rwdnews_events (created_at desc);
create index if not exists rwdnews_events_name_created_idx
  on public.rwdnews_events (event_name, created_at desc);
create index if not exists rwdnews_events_article_idx
  on public.rwdnews_events (article_id, created_at desc);

alter table public.rwdnews_events enable row level security;

drop policy if exists "Anyone can log RWDNEWS events" on public.rwdnews_events;
create policy "Anyone can log RWDNEWS events"
  on public.rwdnews_events
  for insert
  with check (true);

-- Dashboard-only aggregate view. Do not grant public SELECT on raw events.
create or replace view public.v_rwdnews_event_summary as
select
  event_name,
  date_trunc('day', created_at) as day,
  count(*)::bigint as event_count
from public.rwdnews_events
group by event_name, date_trunc('day', created_at)
order by day desc, event_name;


-- Done. Next:
-- 1) Project Settings → API: copy URL + anon key to VITE_* env
-- 2) Service role key only on the Node server (cron ingest)
-- 3) cron-job.org → https://YOUR_HOST/api/cron/ingest?secret=CRON_SECRET
