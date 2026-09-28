-- Global USD advertising: monthly campaigns with flexible duration.
-- Public advertising is USD-only. Legacy historical NGN rows are retained in payment
-- history but are removed from the active public rate card.

alter table if exists public.sponsor_payments
  add column if not exists duration_months integer not null default 1,
  add column if not exists monthly_rate_usd numeric(12,2),
  add column if not exists total_amount_usd numeric(12,2);

alter table if exists public.sponsor_payments
  drop constraint if exists sponsor_payments_duration_months_check;

alter table if exists public.sponsor_payments
  add constraint sponsor_payments_duration_months_check
  check (duration_months between 1 and 12);

update public.sponsor_payments
set duration_months = greatest(1, least(12, ceil(coalesce(duration_days, 30)::numeric / 30)::integer)),
    monthly_rate_usd = case
      when currency = 'USD' then amount / greatest(1, ceil(coalesce(duration_days, 30)::numeric / 30))
      else monthly_rate_usd
    end,
    total_amount_usd = case when currency = 'USD' then amount else total_amount_usd end
where duration_months is null
   or monthly_rate_usd is null
   or total_amount_usd is null;

alter table if exists public.sponsors
  add column if not exists duration_months integer not null default 1,
  add column if not exists monthly_rate_usd numeric(12,2);

alter table if exists public.sponsors
  drop constraint if exists sponsors_duration_months_check;

alter table if exists public.sponsors
  add constraint sponsors_duration_months_check
  check (duration_months between 1 and 12);

-- The active public rate card is USD-only.
delete from public.sponsor_rate_cards where currency <> 'USD';

insert into public.sponsor_rate_cards(package_code,package_name,currency,amount,placement,duration_days)
values
('sidebar','Sidebar Sponsor','USD',75,'sidebar',30),
('in_feed','In-feed Sponsor','USD',100,'in_feed',30),
('homepage','Homepage Featured Sponsor','USD',150,'both',30),
('homepage_sidebar','Homepage + Sidebar','USD',200,'both',30),
('newsletter','Newsletter Sponsor','USD',75,'newsletter',30),
('sponsored_story','Sponsored Article / Briefing','USD',150,'in_feed',30),
('premium','Premium Campaign','USD',300,'both',30)
on conflict (package_code,currency) do update
set package_name=excluded.package_name,
    amount=excluded.amount,
    placement=excluded.placement,
    duration_days=30,
    active=true,
    updated_at=now();

create index if not exists sponsor_payments_duration_idx
  on public.sponsor_payments(duration_months, created_at desc);

create index if not exists sponsors_campaign_dates_idx
  on public.sponsors(active, starts_at, ends_at);

create or replace view public.v_active_sponsor_rate_cards as
select package_code, package_name, currency, amount, placement, duration_days
from public.sponsor_rate_cards
where active = true and currency = 'USD'
order by amount;
