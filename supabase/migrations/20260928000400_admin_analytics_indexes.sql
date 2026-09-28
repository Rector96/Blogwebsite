create index if not exists rwdnews_events_created_at_idx
  on public.rwdnews_events (created_at desc);

create index if not exists rwdnews_events_event_created_at_idx
  on public.rwdnews_events (event_name, created_at desc);

create index if not exists rwdnews_events_article_event_idx
  on public.rwdnews_events (article_id, event_name, created_at desc)
  where article_id is not null;

create index if not exists sponsor_payments_created_at_idx
  on public.sponsor_payments (created_at desc);

create index if not exists sponsor_clicks_created_at_idx
  on public.sponsor_clicks (created_at desc);

create index if not exists sales_leads_created_at_idx
  on public.sales_leads (created_at desc);

create index if not exists newsletter_subscribers_status_created_at_idx
  on public.newsletter_subscribers (status, created_at desc);
