-- How everyone scored on a puzzle day: finished games per total (sparse), for "Top 15% today"
-- and the score graph on the final screen. Totals only, no players.
create function public.score_distribution(p_date date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'n', coalesce(sum(n), 0),
    'counts', coalesce(jsonb_object_agg(total, n), '{}'::jsonb)
  )
  from (
    select total, count(*)::integer as n
      from public.plays
     where puzzle_date = p_date and completed_at is not null and total is not null
     group by total
  ) t;
$$;

revoke all on function public.score_distribution(date) from public, anon, authenticated;
grant execute on function public.score_distribution(date) to service_role;
