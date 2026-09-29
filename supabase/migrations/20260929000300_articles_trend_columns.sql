-- RockBrief Phase P: reconcile the live articles schema with the current News Bot writer.
-- Safe/idempotent: adds only columns required by netlify/functions/news.ts.
alter table public.articles
  add column if not exists trend_score integer not null default 0,
  add column if not exists trend_label text not null default 'Fresh',
  add column if not exists discovered_via jsonb not null default '[]'::jsonb;

create index if not exists articles_trend_score_idx
  on public.articles (trend_score desc, timestamp desc);
