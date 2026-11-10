-- M6 task 6.5: live numbers for the Analytics page that don't fit a per-day row.
-- security definer so it can count accounts in auth.users; executable by service_role only.
create function public.analytics_live(p_today date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with firsts as (
         select player_id, min(puzzle_date) as first_date from public.plays group by player_id
       ),
       pd as (select distinct player_id, puzzle_date from public.plays),
       cohorts as (
         select date_trunc('week', f.first_date)::date as week,
                count(*) as size,
                count(*) filter (where exists (select 1 from pd where pd.player_id = f.player_id and pd.puzzle_date = f.first_date + 1)) as d1,
                count(*) filter (where exists (select 1 from pd where pd.player_id = f.player_id and pd.puzzle_date = f.first_date + 7)) as d7,
                count(*) filter (where exists (select 1 from pd where pd.player_id = f.player_id and pd.puzzle_date = f.first_date + 30)) as d30
           from firsts f
          where f.first_date >= (p_today - 7 * 12)
          group by 1
       ),
       islands as (
         select player_id, puzzle_date,
                puzzle_date - (row_number() over (partition by player_id order by puzzle_date))::integer as grp
           from pd
       ),
       runs as (
         select player_id, count(*) as len, max(puzzle_date) as last_date from islands group by player_id, grp
       ),
       current_streaks as (
         -- A streak is current if it reaches today or yesterday (today may not be played yet).
         select player_id, max(len) as len from runs where last_date >= p_today - 1 group by player_id
       )
  select jsonb_build_object(
    'dau', (select count(distinct player_id) from pd where puzzle_date = p_today),
    'wau', (select count(distinct player_id) from pd where puzzle_date > p_today - 7 and puzzle_date <= p_today),
    'mau', (select count(distinct player_id) from pd where puzzle_date > p_today - 30 and puzzle_date <= p_today),
    'dau_prev', (select count(distinct player_id) from pd where puzzle_date = p_today - 1),
    'wau_prev', (select count(distinct player_id) from pd where puzzle_date > p_today - 14 and puzzle_date <= p_today - 7),
    'mau_prev', (select count(distinct player_id) from pd where puzzle_date > p_today - 60 and puzzle_date <= p_today - 30),
    'total_players', (select count(*) from firsts),
    'accounts', (select count(*) from auth.users where not coalesce(is_anonymous, false) and email is not null),
    'retention', (select coalesce(jsonb_agg(jsonb_build_object('week', week, 'size', size, 'd1', d1, 'd7', d7, 'd30', d30) order by week), '[]'::jsonb) from cohorts),
    'streak_buckets', jsonb_build_object(
      '1', (select count(*) from current_streaks where len = 1),
      '2', (select count(*) from current_streaks where len = 2),
      '3-6', (select count(*) from current_streaks where len between 3 and 6),
      '7-29', (select count(*) from current_streaks where len between 7 and 29),
      '30+', (select count(*) from current_streaks where len >= 30)
    ),
    'streak_7_plus', (select count(*) from current_streaks where len >= 7),
    'streak_30_plus', (select count(*) from current_streaks where len >= 30)
  );
$$;

revoke all on function public.analytics_live(date) from public, anon, authenticated;
grant execute on function public.analytics_live(date) to service_role;
