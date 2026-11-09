-- M3: atomic guess submission + player stats view.
-- Scoring happens in lib/scoring.ts (one implementation); this function only
-- enforces ordering/uniqueness and writes everything in one transaction.

create function public.submit_guess(
  p_play_id     uuid,
  p_player_id   uuid,
  p_position    smallint,
  p_question_id bigint,
  p_guess_log   double precision,
  p_points      smallint,
  p_tier        text,
  p_wrong_way   boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_play     public.plays%rowtype;
  v_existing public.guesses%rowtype;
  v_count    int;
  v_bucket   int;
  v_hist     integer[];
  v_total    int;
begin
  -- Lock the play so concurrent double-taps serialize.
  select * into v_play from public.plays where id = p_play_id for update;
  if not found or v_play.player_id <> p_player_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_existing from public.guesses g where g.play_id = p_play_id and g.position = p_position;
  if found then
    return jsonb_build_object('status', 'already_answered', 'guess', to_jsonb(v_existing));
  end if;

  select count(*) into v_count from public.guesses g where g.play_id = p_play_id;
  if p_position <> v_count + 1 then
    return jsonb_build_object('status', 'out_of_order', 'expected', v_count + 1);
  end if;

  insert into public.guesses (play_id, position, question_id, guess_log, points, tier, wrong_way)
  values (p_play_id, p_position, p_question_id, p_guess_log, p_points, p_tier, p_wrong_way);

  -- Crowd stats: only plays scored live on the server count (DECISIONS item 7).
  if v_play.source = 'server' then
    v_bucket := least(24, greatest(1, floor((p_guess_log + 3) / 0.25)::int + 1));
    v_hist := array_fill(0, array[24]);
    v_hist[v_bucket] := 1;
    insert into public.round_stats as rs (puzzle_date, position, n, sum_points, n_wrong_way, n_nailed, histogram)
    values (v_play.puzzle_date, p_position, 1, p_points, p_wrong_way::int, (p_tier = 'nailed')::int, v_hist)
    on conflict (puzzle_date, position) do update set
      n           = rs.n + 1,
      sum_points  = rs.sum_points + excluded.sum_points,
      n_wrong_way = rs.n_wrong_way + excluded.n_wrong_way,
      n_nailed    = rs.n_nailed + excluded.n_nailed,
      histogram[v_bucket] = rs.histogram[v_bucket] + 1;
  end if;

  if p_position = 5 then
    select sum(points) into v_total from public.guesses g where g.play_id = p_play_id;
    update public.plays set completed_at = now(), total = v_total where id = p_play_id;
  end if;

  return jsonb_build_object('status', 'ok', 'total', v_total, 'completed', p_position = 5);
end;
$$;

revoke all on function public.submit_guess(uuid, uuid, smallint, bigint, double precision, smallint, text, boolean) from public, anon, authenticated;
grant execute on function public.submit_guess(uuid, uuid, smallint, bigint, double precision, smallint, text, boolean) to service_role;

-- Player stats (SPEC §6). Streaks need the date-line rule, so they're computed
-- in TypeScript from plays (lib/streaks.ts), not in SQL (DECISIONS.md).
create view public.player_stats with (security_invoker = true) as
select
  p.id as player_id,
  coalesce(pl.games_played, 0) as games_played,
  pl.best_total,
  pl.avg_total,
  coalesce(t.nailed, 0) as tier_nailed,
  coalesce(t.close, 0)  as tier_close,
  coalesce(t.meh, 0)    as tier_meh,
  coalesce(t.off, 0)    as tier_off,
  coalesce(t.wrong, 0)  as tier_wrong
from public.players p
left join lateral (
  select count(*)::int as games_played, max(total)::int as best_total, round(avg(total))::int as avg_total
  from public.plays where player_id = p.id and completed_at is not null
) pl on true
left join lateral (
  select
    count(*) filter (where g.tier = 'nailed')::int as nailed,
    count(*) filter (where g.tier = 'close')::int  as close,
    count(*) filter (where g.tier = 'meh')::int    as meh,
    count(*) filter (where g.tier = 'off')::int    as off,
    count(*) filter (where g.tier = 'wrong')::int  as wrong
  from public.guesses g join public.plays x on x.id = g.play_id
  where x.player_id = p.id and x.completed_at is not null
) t on true;

revoke all on public.player_stats from anon, authenticated;
grant select on public.player_stats to service_role;

-- Index for "my plays, newest first" (GET /api/me).
create index plays_player_started_idx on public.plays (player_id, started_at desc);
