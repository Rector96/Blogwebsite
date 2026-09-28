create or replace function public.get_rockbrief_admin_analytics(p_since timestamptz default now() - interval '30 days')
returns jsonb
language sql
security definer
set search_path = public
as $$
with ev as (
  select event_name, article_id, page_path, source, country, city, device, browser, session_id, created_at
  from public.rwdnews_events
  where created_at >= p_since
),
pv as (
  select * from ev where event_name = 'page_view'
),
agg_source as (
  select coalesce(source, 'Unknown') as label, count(*)::bigint as value from pv group by 1 order by value desc limit 15
),
agg_country as (
  select coalesce(country, 'Unknown') as label, count(*)::bigint as value from pv group by 1 order by value desc limit 15
),
agg_city as (
  select coalesce(city, 'Unknown') as label, count(*)::bigint as value from pv group by 1 order by value desc limit 15
),
agg_device as (
  select coalesce(device, 'Unknown') as label, count(*)::bigint as value from pv group by 1 order by value desc limit 15
),
agg_browser as (
  select coalesce(browser, 'Unknown') as label, count(*)::bigint as value from pv group by 1 order by value desc limit 15
),
agg_path as (
  select coalesce(page_path, 'Unknown') as label, count(*)::bigint as value from pv group by 1 order by value desc limit 15
),
daily as (
  select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*)::bigint as value
  from pv group by 1 order by 1 desc limit 30
),
top_articles as (
  select article_id::text as id, count(*)::bigint as views
  from ev
  where article_id is not null and event_name in ('article_open','page_view')
  group by article_id order by views desc limit 15
),
paid as (
  select
    coalesce(sum(case when upper(coalesce(currency,'')) = 'USD' then coalesce(amount_usd, amount, 0) else 0 end),0)::numeric as usd,
    coalesce(sum(case when upper(coalesce(currency,'')) = 'NGN' then coalesce(amount_naira, amount, 0) else 0 end),0)::numeric as naira,
    count(*) filter (where status = 'pending')::bigint as pending
  from public.sponsor_payments
),
sponsor_clicks as (
  select count(*)::bigint as total from public.sponsor_clicks where created_at >= p_since
),
leads as (
  select count(*)::bigint as total from public.sales_leads where created_at >= p_since
),
newsletter as (
  select count(*)::bigint as total from public.newsletter_subscribers where status = 'active'
)
select jsonb_build_object(
  'page_views', (select count(*)::bigint from pv),
  'unique_sessions', (select count(distinct session_id)::bigint from pv where session_id is not null),
  'article_opens', (select count(*)::bigint from ev where event_name='article_open'),
  'shares', (select count(*)::bigint from ev where event_name='article_share'),
  'saves', (select count(*)::bigint from ev where event_name='article_save'),
  'sponsor_clicks', (select total from sponsor_clicks),
  'advertiser_leads', (select total from leads),
  'newsletter_subscribers', (select total from newsletter),
  'paid_revenue_naira', (select naira from paid),
  'paid_revenue_usd', (select usd from paid),
  'pending_payments', (select pending from paid),
  'daily', coalesce((select jsonb_agg(jsonb_build_object('day',day,'value',value) order by day) from daily),'[]'::jsonb),
  'sources', coalesce((select jsonb_agg(jsonb_build_object('label',label,'value',value) order by value desc) from agg_source),'[]'::jsonb),
  'countries', coalesce((select jsonb_agg(jsonb_build_object('label',label,'value',value) order by value desc) from agg_country),'[]'::jsonb),
  'cities', coalesce((select jsonb_agg(jsonb_build_object('label',label,'value',value) order by value desc) from agg_city),'[]'::jsonb),
  'devices', coalesce((select jsonb_agg(jsonb_build_object('label',label,'value',value) order by value desc) from agg_device),'[]'::jsonb),
  'browsers', coalesce((select jsonb_agg(jsonb_build_object('label',label,'value',value) order by value desc) from agg_browser),'[]'::jsonb),
  'top_paths', coalesce((select jsonb_agg(jsonb_build_object('label',label,'value',value) order by value desc) from agg_path),'[]'::jsonb),
  'top_articles', coalesce((select jsonb_agg(jsonb_build_object('id',id,'views',views) order by views desc) from top_articles),'[]'::jsonb),
  'engagement', jsonb_build_object(
    'recommendation_impressions',(select count(*)::bigint from ev where event_name='recommendation_impression'),
    'recommendation_clicks',(select count(*)::bigint from ev where event_name='recommendation_click'),
    'engaged_reads',(select count(*)::bigint from ev where event_name='reading_engaged'),
    'return_visits',(select count(*)::bigint from ev where event_name='return_visit'),
    'search_events',(select count(*)::bigint from ev where event_name='search'),
    'external_source_clicks',(select count(*)::bigint from ev where event_name='external_source_click'),
    'returning_sessions',(select count(*)::bigint from (select session_id from pv where session_id is not null group by session_id having count(*) > 1) x)
  )
);
$$;

revoke all on function public.get_rockbrief_admin_analytics(timestamptz) from public, anon, authenticated;
grant execute on function public.get_rockbrief_admin_analytics(timestamptz) to service_role;
