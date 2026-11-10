-- M6 task 6.4: first-party, cookieless analytics (SPEC §8 "How it is measured", §11 events).
-- Service role only (RLS on, no policies). Only aggregates are ever shown.

-- One row per visitor per puzzle day, written server-side on page load (before Play).
-- visitor_hash is a daily-rotating salted hash of IP + user agent + date: no cookie, and it
-- can't link a person across days.
create table public.visits (
  id           bigint generated always as identity primary key,
  visitor_hash text not null,
  puzzle_date  date not null,
  country      text,
  device       text not null check (device in ('mobile', 'tablet', 'desktop')),
  referrer     text,               -- domain only; null under Do Not Track / GPC, or same-site
  from_share   boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (visitor_hash, puzzle_date)
);
create index visits_puzzle_date_idx on public.visits (puzzle_date);
alter table public.visits enable row level security;

-- Events only the browser (or auth) knows about. Plays, guesses, completions and share landings
-- are already in plays / guesses / visits.
create table public.events (
  id           bigint generated always as identity primary key,
  user_id      uuid,
  visitor_hash text,
  name         text not null check (name in ('share_clicked', 'signup_prompt_shown', 'signup_completed')),
  props        jsonb not null default '{}'::jsonb,
  puzzle_date  date,
  created_at   timestamptz not null default now()
);
create index events_name_date_idx on public.events (name, puzzle_date);
alter table public.events enable row level security;

-- One row per finished puzzle day: every number the Analytics page needs for that day.
create table public.daily_metrics (
  puzzle_date date primary key,
  metrics     jsonb not null,
  computed_at timestamptz not null default now()
);
alter table public.daily_metrics enable row level security;

revoke all on public.visits, public.events, public.daily_metrics from anon, authenticated;

-- All of one day's numbers (also used live for today, cached by the app).
create function public.compute_daily_metrics(p_date date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with v as (select * from public.visits where puzzle_date = p_date),
       p as (select * from public.plays where puzzle_date = p_date),
       firsts as (
         select pl.player_id, min(pl.puzzle_date) as first_date
           from public.plays pl
          where pl.player_id in (select player_id from p)
          group by pl.player_id
       ),
       g as (select g.* from public.guesses g join p on p.id = g.play_id),
       e as (select * from public.events where puzzle_date = p_date),
       done as (select total from p where completed_at is not null and total is not null)
  select jsonb_build_object(
    'visits', (select count(*) from v),
    'visits_from_share', (select count(*) from v where from_share),
    'visits_by_device', (select coalesce(jsonb_object_agg(device, n), '{}'::jsonb) from (select device, count(*) as n from v group by device) x),
    'visits_by_country', (select coalesce(jsonb_object_agg(country, n), '{}'::jsonb) from (select coalesce(country, '??') as country, count(*) as n from v group by 1 order by 2 desc limit 30) x),
    'referrers', (select coalesce(jsonb_object_agg(referrer, n), '{}'::jsonb) from (select referrer, count(*) as n from v where referrer is not null group by 1 order by 2 desc limit 15) x),
    'players', (select count(*) from p),
    'new_players', (select count(*) from firsts where first_date = p_date),
    'completed', (select count(*) from done),
    'rounds_locked', (select jsonb_agg(coalesce((select count(*) from g where g.position = k), 0) order by k) from generate_series(1, 5) as k),
    'avg_total', (select round(avg(total), 1) from done),
    'score_buckets', (select jsonb_agg(coalesce((select count(*) from done where least(total / 50, 9) = b), 0) order by b) from generate_series(0, 9) as b),
    'avg_points_by_round', (select jsonb_agg((select round(avg(points), 1) from g where g.position = k) order by k) from generate_series(1, 5) as k),
    'wrong_way_by_round', (select jsonb_agg((select count(*) from g where g.position = k and g.wrong_way) order by k) from generate_series(1, 5) as k),
    'shares', (select count(*) from e where name = 'share_clicked'),
    'sharers', (select count(distinct coalesce(user_id::text, visitor_hash)) from e where name = 'share_clicked'),
    'shares_by_method', (select coalesce(jsonb_object_agg(m, n), '{}'::jsonb) from (select coalesce(props->>'method', 'unknown') as m, count(*) as n from e where name = 'share_clicked' group by 1) x),
    'signup_prompts', (select count(*) from e where name = 'signup_prompt_shown'),
    'signups', (select count(*) from e where name = 'signup_completed')
  );
$$;

revoke all on function public.compute_daily_metrics(date) from public, anon, authenticated;
grant execute on function public.compute_daily_metrics(date) to service_role;
