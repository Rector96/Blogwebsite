-- RWDNEWS Phase 1: manual editorial publishing fields
alter table if exists public.articles
  add column if not exists story_type text not null default 'WIRE',
  add column if not exists body text not null default '',
  add column if not exists category text not null default 'Business',
  add column if not exists region text not null default 'Global',
  add column if not exists subject text not null default '',
  add column if not exists author_name text not null default 'RWDNEWS Editorial',
  add column if not exists image_credit text not null default '',
  add column if not exists image_license text not null default '',
  add column if not exists image_source_url text not null default '',
  add column if not exists published_by text not null default '';

do $$ begin
  alter table public.articles drop constraint if exists articles_story_type_check;
  alter table public.articles add constraint articles_story_type_check
    check (story_type in ('WIRE','RWDNEWS ORIGINAL','DEVELOPING'));
exception when undefined_table then null; end $$;

create index if not exists articles_story_type_idx on public.articles(story_type, timestamp desc);
create index if not exists articles_category_idx on public.articles(category, timestamp desc);
create index if not exists articles_region_idx on public.articles(region, timestamp desc);
