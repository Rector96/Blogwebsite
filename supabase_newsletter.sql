-- Newsletter capture for FinSignal weekly brief
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text default 'web',
  created_at timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

-- Anon can insert (subscribe); no public read
create policy "Anyone can subscribe"
  on public.newsletter_subscribers
  for insert
  with check (true);
