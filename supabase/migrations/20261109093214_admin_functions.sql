-- M5 task 5.8: admin portal reads and edits (server-only).
-- NOTE: reorder_rounds below is broken as applied (shifting positions breaks the 1..5 check).
-- The fix (rewrite the day's rounds) is pending Dani's OK: see PROGRESS "Needs from Dani".
-- Nothing calls reorder_rounds until then.

-- Per-question play stats: plays (= players who saw the reveal), avg points, wrong-way %, reports.
create function public.question_stats(p_ids bigint[])
returns table (question_id bigint, plays integer, avg_points double precision, wrong_way_pct double precision, reports integer, valid_reports integer)
language sql
stable
set search_path = ''
as $$
  select q.id,
         count(g.play_id)::integer,
         avg(g.points)::double precision,
         (100.0 * avg(case when g.wrong_way then 1 else 0 end))::double precision,
         (select count(*) from public.reports r where r.question_id = q.id)::integer,
         (select count(*) from public.reports r where r.question_id = q.id and r.valid)::integer
    from unnest(p_ids) as q(id)
    left join public.guesses g on g.question_id = q.id
   group by q.id;
$$;

-- Swap the question in one round for a verified, never-scheduled one. The old question
-- gets p_old_status ('verified' back to the pool, 'flagged' to fix, or 'retired').
-- Guesses already made keep their own question_id, so past scores are untouched.
-- Returns 'ok', 'no_round', or 'unavailable'.
create function public.swap_round(p_date date, p_position smallint, p_new_id bigint, p_old_status text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  old_id bigint;
begin
  if p_old_status not in ('verified', 'flagged', 'retired') then
    raise exception 'bad p_old_status %', p_old_status using errcode = '22023';
  end if;
  select question_id into old_id from public.puzzle_rounds where puzzle_date = p_date and position = p_position for update;
  if old_id is null then
    return 'no_round';
  end if;
  perform 1 from public.questions where id = p_new_id for update;
  if not exists (
    select 1 from public.questions q
     where q.id = p_new_id and q.status = 'verified'
       and not exists (select 1 from public.puzzle_rounds r where r.question_id = q.id)
  ) then
    return 'unavailable';
  end if;
  update public.puzzle_rounds set question_id = p_new_id where puzzle_date = p_date and position = p_position;
  update public.questions set status = 'scheduled' where id = p_new_id;
  -- A question that was answered keeps 'used' history via guesses; its status follows the admin's choice.
  update public.questions set status = p_old_status where id = old_id;
  return 'ok';
end;
$$;

-- Put a day's 5 questions in a new order (future days only: nobody has played them).
create function public.reorder_rounds(p_date date, p_ids bigint[])
returns text
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(array_length(p_ids, 1), 0) <> 5 then
    raise exception 'reorder_rounds needs 5 ids' using errcode = '22023';
  end if;
  if exists (select 1 from public.plays where puzzle_date = p_date) then
    return 'played';
  end if;
  if (select count(*) from public.puzzle_rounds where puzzle_date = p_date and question_id = any (p_ids)) <> 5 then
    return 'mismatch';
  end if;
  update public.puzzle_rounds set position = position + 10 where puzzle_date = p_date;
  update public.puzzle_rounds r set position = t.ord
    from unnest(p_ids) with ordinality as t(qid, ord)
   where r.puzzle_date = p_date and r.question_id = t.qid;
  return 'ok';
end;
$$;

revoke all on function public.question_stats(bigint[]) from public, anon, authenticated;
revoke all on function public.swap_round(date, smallint, bigint, text) from public, anon, authenticated;
revoke all on function public.reorder_rounds(date, bigint[]) from public, anon, authenticated;
grant execute on function public.question_stats(bigint[]) to service_role;
grant execute on function public.swap_round(date, smallint, bigint, text) to service_role;
grant execute on function public.reorder_rounds(date, bigint[]) to service_role;
