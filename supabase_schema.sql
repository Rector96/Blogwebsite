-- ==============================================================================
-- SUPABASE SCHEMA FOR PERSONAL FINANCE & FINTECH NEWS HUB
-- Paste this entire script into your Supabase Dashboard -> SQL Editor and click "RUN"
-- ==============================================================================

-- 1. Create the 'articles' table to store curated and AI-enriched stories
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

-- 2. Create index on timestamp for fast feed queries
create index if not exists articles_timestamp_idx on public.articles (timestamp desc);

-- 3. Enable Row Level Security (RLS)
alter table public.articles enable row level security;

-- 4. Allow public anonymous read access (so your Netlify website can read articles)
create policy "Allow public read access to articles"
  on public.articles
  for select
  using (true);

-- 5. Seed initial high-quality curated articles
insert into public.articles (id, original_url, original_title, original_description, ai_hook_title, ai_summary, tags, source, image, read_time, timestamp)
values 
(
  'supa-art-1',
  'https://www.marketwatch.com/personal-finance/banking/high-yield-cash-sweeps',
  'Treasury Yield Inversion Normalizes as Neobanks Shift Savings Sweep Yields to 5.15%',
  'Digital banking platforms leverage multi-bank custodial networks to deliver elevated cash yields directly to consumer transaction accounts.',
  'High-Yield Cash Sweeps Reach 5.15% APY as Fintechs Compete for Uninvested Deposits',
  '["Cash yields have detached from legacy 0.01% savings rates, granting disciplined households hundreds in passive interest income without risk.", "Multi-bank sweep syndicates insure retail balances up to $5M, transforming personal cash savings into institutional-grade reserves."]'::jsonb,
  array['#Fintech', '#Banking', '#PersonalFinance'],
  'MarketWatch',
  'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80',
  '3 min read',
  now() - interval '15 minutes'
),
(
  'supa-art-2',
  'https://www.consumerfinance.gov/about-us/newsroom/cfpb-finalizes-personal-financial-data-rights/',
  'CFPB Rule 1033 Mandates Consumer Financial Data Portability Across Brokerages and Banks',
  'The final open banking rules phase out screen-scraping authentication in favor of secure bank-level APIs, granting account holders instant ownership of loan and transaction records.',
  'Open Banking Rule 1033 Finalized: Secure API Portability Eliminates Password Scraping',
  '["Prohibits opaque credential scraping, replacing password sharing with cryptographically signed, revocable bank tokens.", "Empowers budget aggregators and debt refi engines to pinpoint lower interest options automatically with zero manual friction."]'::jsonb,
  array['#Fintech', '#Regulation', '#Banking'],
  'CFPB Wire',
  'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80',
  '4 min read',
  now() - interval '45 minutes'
),
(
  'supa-art-3',
  'https://www.finextra.com/newsarticle/realtime-payroll-earned-wage-access',
  'Real-Time Payroll Integrations Displace Traditional Payday Lending with Earned Wage Access',
  'Direct payroll API bridges allow hourly wage earners to draw accrued income on demand, avoiding predatory overdraft penalties and triple-digit APR payday cycles.',
  'Real-Time Payroll Rails Expand Earned Wage Access to Curtail Payday Loan Debt',
  '["Hourly workers access earned income instantaneously between payroll cycles, shielding bank accounts from overdraft fines.", "Bypasses predatory triple-digit short-term debt traps with zero-fee employer-integrated liquidity rails."]'::jsonb,
  array['#Fintech', '#Payments', '#PersonalFinance'],
  'Finextra',
  'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80',
  '3 min read',
  now() - interval '90 minutes'
)
on conflict (original_url) do nothing;
