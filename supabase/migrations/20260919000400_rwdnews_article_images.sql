-- RWDNEWS Phase 2: private admin uploads to a public article image bucket.
insert into storage.buckets (id, name, public)
values ('rwdnews-images', 'rwdnews-images', true)
on conflict (id) do update set public = true;
