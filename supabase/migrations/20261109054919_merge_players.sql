-- M4: move an anonymous player's history into an existing account (SPEC §5).
-- For each puzzle_date: if the account has no play, move the anonymous play;
-- on a clash keep the EARLIER-STARTED play (the first attempt is the honest one).
-- Runs as one transaction; the caller deletes the anonymous auth user afterwards.
create function public.merge_players(p_from uuid, p_to uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_anon     public.plays%rowtype;
  v_existing public.plays%rowtype;
  v_moved    int := 0;  -- anonymous plays now on the account
  v_kept     int := 0;  -- clashes where the account's own (earlier) play was kept
  v_replaced int := 0;  -- clashes where the anonymous play was earlier and replaced the account's
begin
  if p_from = p_to then
    return jsonb_build_object('merged', 0, 'kept', 0, 'replaced', 0);
  end if;
  -- Lock both players' plays so concurrent merges/guesses serialize.
  perform 1 from public.plays where player_id in (p_from, p_to) for update;

  for v_anon in select * from public.plays where player_id = p_from order by puzzle_date loop
    select * into v_existing from public.plays where player_id = p_to and puzzle_date = v_anon.puzzle_date;
    if not found then
      update public.plays set player_id = p_to where id = v_anon.id;
      v_moved := v_moved + 1;
    elsif v_anon.started_at < v_existing.started_at then
      delete from public.plays where id = v_existing.id;  -- cascades its guesses
      update public.plays set player_id = p_to where id = v_anon.id;
      v_moved := v_moved + 1;
      v_replaced := v_replaced + 1;
    else
      v_kept := v_kept + 1;  -- the anonymous play is discarded with the anonymous user
    end if;
  end loop;

  -- Reports move too, unless the account already reported that question.
  update public.reports r set player_id = p_to
  where r.player_id = p_from
    and not exists (select 1 from public.reports x where x.player_id = p_to and x.question_id = r.question_id);

  return jsonb_build_object('merged', v_moved, 'kept', v_kept, 'replaced', v_replaced);
end;
$$;

revoke all on function public.merge_players(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_players(uuid, uuid) to service_role;
