-- Remove legacy demo sponsor inventory from the live database.
-- Real sponsors must be created only through the admin/payment flow.
delete from public.sponsors
where slug in ('partner-cash-demo', 'partner-invest-demo')
   or sponsor_name in ('Partner · Cash', 'Partner · Investing');

-- Keep newsletter sponsorships distinct from display inventory.
do $$ begin
  alter table public.sponsors drop constraint if exists sponsors_placement_check;
  alter table public.sponsors add constraint sponsors_placement_check
    check (placement in ('sidebar', 'in_feed', 'both', 'newsletter'));
exception when undefined_table then null; end $$;
