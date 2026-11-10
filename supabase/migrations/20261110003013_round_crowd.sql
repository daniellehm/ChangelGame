-- M6 task 6.3: crowd stats per round for one puzzle day (SPEC §10 crowd line + "Today's trap").
-- Counts only guesses on the question currently in that round (a same-day swap doesn't mix questions),
-- from plays of that date (a rerun day starts its own count).
create function public.round_crowd(p_date date)
returns table (pos smallint, plays integer, wrong_way integer, nailed integer, avg_points numeric)
language sql
stable
set search_path = ''
as $$
  select g.position,
         count(*)::integer,
         (count(*) filter (where g.wrong_way))::integer,
         (count(*) filter (where g.tier = 'nailed'))::integer,
         round(avg(g.points), 1)
    from public.guesses g
    join public.plays p on p.id = g.play_id and p.puzzle_date = p_date
    join public.puzzles z on z.puzzle_date = p_date
    join public.puzzle_rounds r on r.puzzle_date = coalesce(z.rerun_of, z.puzzle_date)
                               and r.position = g.position
                               and r.question_id = g.question_id
   group by g.position
   order by g.position;
$$;

revoke all on function public.round_crowd(date) from public, anon, authenticated;
grant execute on function public.round_crowd(date) to service_role;
