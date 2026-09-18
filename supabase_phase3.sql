-- RWDNEWS Phase 3: engagement + revenue measurement
-- Run once in Supabase SQL Editor.
-- Safe to re-run: objects are created/replaced idempotently.

create table if not exists public.rwdnews_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in (
    'article_open','article_share','article_save',
    'newsletter_signup','sponsor_click','advertise_open'
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

create or replace view public.v_rwdnews_event_summary as
select
  event_name,
  date_trunc('day', created_at) as day,
  count(*)::bigint as event_count
from public.rwdnews_events
group by event_name, date_trunc('day', created_at)
order by day desc, event_name;
