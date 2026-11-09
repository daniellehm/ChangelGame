-- M5 task 5.5: scheduler writes (SPEC §8 "Schedule"). Server-only.

-- Create a ready puzzle for p_date from 5 verified, never-scheduled questions, atomically.
-- Returns 'ok', 'exists' (the date already has a puzzle) or 'unavailable' (a question was taken or isn't verified).
create function public.schedule_puzzle(p_date date, p_question_ids bigint[])
returns text
language plpgsql
set search_path = ''
as $$
declare
  n integer;
begin
  if coalesce(array_length(p_question_ids, 1), 0) <> 5
     or (select count(distinct x) from unnest(p_question_ids) as t(x)) <> 5 then
    raise exception 'schedule_puzzle needs 5 distinct questions' using errcode = '22023';
  end if;
  if exists (select 1 from public.puzzles where puzzle_date = p_date) then
    return 'exists';
  end if;
  -- Lock the questions so two hops can't schedule the same one.
  perform 1 from public.questions where id = any (p_question_ids) for update;
  select count(*) into n
    from public.questions q
   where q.id = any (p_question_ids)
     and q.status = 'verified'
     and not exists (select 1 from public.puzzle_rounds r where r.question_id = q.id);
  if n <> 5 then
    return 'unavailable';
  end if;
  insert into public.puzzles (puzzle_date, status) values (p_date, 'ready');
  insert into public.puzzle_rounds (puzzle_date, position, question_id)
    select p_date, t.ord, t.qid from unnest(p_question_ids) with ordinality as t(qid, ord);
  update public.questions set status = 'scheduled' where id = any (p_question_ids);
  return 'ok';
end;
$$;

-- Scheduled questions whose puzzle date is before p_before become 'used'. Returns how many.
create function public.mark_used_questions(p_before date)
returns integer
language sql
volatile
set search_path = ''
as $$
  with done as (
    update public.questions q
       set status = 'used'
     where q.status = 'scheduled'
       and exists (select 1 from public.puzzle_rounds r where r.question_id = q.id and r.puzzle_date < p_before)
    returning 1
  )
  select count(*)::integer from done;
$$;

revoke all on function public.schedule_puzzle(date, bigint[]) from public, anon, authenticated;
revoke all on function public.mark_used_questions(date) from public, anon, authenticated;
grant execute on function public.schedule_puzzle(date, bigint[]) to service_role;
grant execute on function public.mark_used_questions(date) to service_role;
