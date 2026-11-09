-- M5 task 5.9: the Reports queue (SPEC §8 "Safety nets"). Server-only.
-- report rate = valid reports ÷ players who saw that round's reveal (= guesses on the question).
-- A report is valid if the player locked in that round (checked on insert: reports.valid) and the
-- player isn't a habitual reporter (> p_habitual of their rounds reported, once they've played
-- at least p_habitual_min_rounds rounds), worked out live from their whole history.
-- A dismissed question only re-queues once its rate is p_requeue_points higher than at dismissal.
create function public.report_queue(
  p_min_rate double precision,
  p_min_reports integer,
  p_habitual double precision,
  p_habitual_min_rounds integer,
  p_requeue_points double precision
)
returns table (question_id bigint, seen integer, valid_reports integer, rate double precision, dismissed_rate double precision)
language sql
stable
set search_path = ''
as $$
  with reporters as (
    select r.player_id, count(*) as n_reports from public.reports r group by r.player_id
  ), rounds as (
    select p.player_id, count(*) as n_rounds
      from public.guesses g join public.plays p on p.id = g.play_id
     where p.player_id in (select player_id from reporters)
     group by p.player_id
  ), habitual as (
    select rep.player_id from reporters rep join rounds ro using (player_id)
     where ro.n_rounds >= p_habitual_min_rounds and rep.n_reports::double precision / ro.n_rounds > p_habitual
  ), counts as (
    select r.question_id,
           count(*) filter (where r.valid and r.player_id not in (select player_id from habitual)) as valid_reports
      from public.reports r
     group by r.question_id
  ), seen as (
    select g.question_id, count(*) as seen
      from public.guesses g
     where g.question_id in (select question_id from counts)
     group by g.question_id
  )
  select c.question_id, s.seen::integer, c.valid_reports::integer,
         c.valid_reports::double precision / s.seen as rate,
         q.reports_dismissed_rate
    from counts c
    join seen s using (question_id)
    join public.questions q on q.id = c.question_id
   where c.valid_reports >= p_min_reports
     and c.valid_reports::double precision / s.seen > p_min_rate
     and (q.reports_dismissed_rate is null
          or c.valid_reports::double precision / s.seen >= q.reports_dismissed_rate + p_requeue_points)
   order by 4 desc;
$$;

revoke all on function public.report_queue(double precision, integer, double precision, integer, double precision) from public, anon, authenticated;
grant execute on function public.report_queue(double precision, integer, double precision, integer, double precision) to service_role;
