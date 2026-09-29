-- Phase N: production-safe News Bot lease lock.
create table if not exists public.bot_run_locks (
  lock_name text primary key,
  owner text not null,
  locked_until timestamptz not null,
  acquired_at timestamptz not null default now()
);

alter table public.bot_run_locks enable row level security;
revoke all on table public.bot_run_locks from anon, authenticated;

create or replace function public.try_acquire_bot_lock(
  p_lock_name text,
  p_owner text,
  p_lease_seconds integer default 900
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(trim(p_lock_name), '') = '' or coalesce(trim(p_owner), '') = '' then
    return false;
  end if;

  insert into public.bot_run_locks(lock_name, owner, locked_until, acquired_at)
  values (
    p_lock_name,
    p_owner,
    now() + make_interval(secs => greatest(60, least(p_lease_seconds, 3600))),
    now()
  )
  on conflict (lock_name) do update
    set owner = excluded.owner,
        locked_until = excluded.locked_until,
        acquired_at = excluded.acquired_at
    where public.bot_run_locks.locked_until <= now();

  return found;
end;
$$;

create or replace function public.release_bot_lock(
  p_lock_name text,
  p_owner text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.bot_run_locks
  where lock_name = p_lock_name
    and owner = p_owner;
  return found;
end;
$$;

revoke execute on function public.try_acquire_bot_lock(text, text, integer) from public, anon, authenticated;
revoke execute on function public.release_bot_lock(text, text) from public, anon, authenticated;
grant execute on function public.try_acquire_bot_lock(text, text, integer) to service_role;
grant execute on function public.release_bot_lock(text, text) to service_role;
