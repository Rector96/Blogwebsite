-- Expand story_type check so Admin can publish Explainers, Bios, Features, etc.
-- Run this in Supabase SQL Editor if deploy does not apply migrations automatically.

alter table public.articles drop constraint if exists articles_story_type_check;

alter table public.articles add constraint articles_story_type_check
  check (
    story_type in (
      'WIRE',
      'DEVELOPING',
      'RockBrief ORIGINAL',
      'RWDNEWS ORIGINAL',
      'EXPLAINER',
      'BIO',
      'PROFILE',
      'FEATURE',
      'COMMENTARY'
    )
  );

-- Normalize legacy label if present
update public.articles
set story_type = 'RockBrief ORIGINAL'
where story_type = 'RWDNEWS ORIGINAL';
