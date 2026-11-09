-- M4 task 4.7 (SPEC §5 housekeeping): anonymous users to purge nightly.
--  * anonymous, created > 7 days ago, and no plays at all
--  * anonymous and inactive (players.last_seen_at) for > 400 days
-- Permanent accounts are never returned. Server-only (service_role).
create function public.cleanup_candidates(p_now timestamptz default now(), p_limit int default 500)
returns table (user_id uuid, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, 'no_plays_7d'
  from auth.users u
  where u.is_anonymous
    and u.created_at < p_now - interval '7 days'
    and not exists (select 1 from public.plays p where p.player_id = u.id)
  union all
  select u.id, 'inactive_400d'
  from auth.users u
  join public.players pl on pl.id = u.id
  where u.is_anonymous
    and pl.last_seen_at < p_now - interval '400 days'
    and exists (select 1 from public.plays p where p.player_id = u.id)
  limit p_limit;
$$;

revoke all on function public.cleanup_candidates(timestamptz, int) from public, anon, authenticated;
grant execute on function public.cleanup_candidates(timestamptz, int) to service_role;
