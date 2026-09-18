-- RWDNEWS Phase 4 database hardening
-- Run after the earlier Phase 3 event schema was created.

delete from public.articles
where id in ('supa-art-1','supa-art-2','supa-art-3');

delete from public.sponsors
where slug in ('partner-cash-demo','partner-invest-demo');

revoke all on table public.rwdnews_events from anon, authenticated;
grant insert on table public.rwdnews_events to anon, authenticated;

revoke all on table public.v_rwdnews_event_summary from anon, authenticated;
