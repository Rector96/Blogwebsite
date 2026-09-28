-- RockBrief newsroom schema — story types, trust fields, indexes
-- Run in Supabase SQL Editor (safe to re-run)

-- Core editorial fields
alter table public.articles
  add column if not exists story_type text,
  add column if not exists subject text,
  add column if not exists author_name text,
  add column if not exists category text,
  add column if not exists region text,
  add column if not exists body text,
  add column if not exists featured boolean default false,
  add column if not exists pinned boolean default false,
  add column if not exists image_credit text,
  add column if not exists image_license text,
  add column if not exists image_source_url text,
  add column if not exists updated_at timestamptz;

-- Defaults aligned with big-newsroom types
update public.articles
set story_type = coalesce(nullif(trim(story_type), ''), 'WIRE')
where story_type is null or trim(story_type) = '';

alter table public.articles
  alter column story_type set default 'WIRE';

-- Normalize legacy labels toward standard desk vocabulary
update public.articles set story_type = 'FEATURE'
where story_type ilike '%original%' or story_type ilike '%feature%';

update public.articles set story_type = 'DEVELOPING'
where story_type ilike '%develop%';

update public.articles set story_type = 'EXPLAINER'
where story_type ilike '%explain%'
   or category ilike 'explainer%'
   or exists (
     select 1 from unnest(coalesce(tags, array[]::text[])) t
     where t ilike '%explainer%'
   );

update public.articles set story_type = 'BIO'
where story_type ilike '%bio%'
   or story_type ilike '%profile%'
   or category ilike 'profile%'
   or category ilike 'biograph%'
   or exists (
     select 1 from unnest(coalesce(tags, array[]::text[])) t
     where t ilike '%biograph%' or t ilike '%profile%'
   );

-- Editorial status: published | draft | hidden | pending
-- (keep existing values; ensure column exists)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'articles' and column_name = 'editorial_status'
  ) then
    alter table public.articles add column editorial_status text default 'published';
  end if;
end $$;

update public.articles
set editorial_status = coalesce(nullif(trim(editorial_status), ''), 'published')
where editorial_status is null or trim(editorial_status) = '';

-- updated_at maintenance
update public.articles
set updated_at = coalesce(updated_at, timestamp, now())
where updated_at is null;

alter table public.articles
  alter column updated_at set default now();

create or replace function public.set_articles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
before update on public.articles
for each row execute function public.set_articles_updated_at();

-- Indexes for hubs + freshness + admin filters
create index if not exists articles_editorial_status_timestamp_idx
  on public.articles (editorial_status, timestamp desc);

create index if not exists articles_story_type_status_idx
  on public.articles (story_type, editorial_status, timestamp desc);

create index if not exists articles_category_status_idx
  on public.articles (category, editorial_status, timestamp desc);

create index if not exists articles_featured_pinned_idx
  on public.articles (featured, pinned, timestamp desc)
  where editorial_status = 'published';

-- Optional constraint helper comment (not enforced as check to avoid breaking legacy rows)
comment on column public.articles.story_type is
  'WIRE | DEVELOPING | FEATURE | EXPLAINER | BIO | PROFILE | COMMENTARY | RockBrief ORIGINAL';

comment on column public.articles.editorial_status is
  'published | draft | hidden | pending — only published is public';

comment on column public.articles.image_license is
  'Required for trust: Owned, Licensed, Editorial, or Public domain + credit';
