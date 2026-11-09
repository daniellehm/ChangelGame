-- M2 core schema (SPEC §6 + accepted fixes in DECISIONS.md 2026-11-09).
-- Clients never query these tables directly except their own plays/guesses/player
-- row (RLS). Everything else goes through server routes using the service role.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------- players
create table public.players (
  id           uuid primary key references auth.users (id) on delete cascade,
  tz           text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
comment on table public.players is 'One row per auth user (anonymous or permanent), created by trigger.';

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.players (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------- questions
create table public.questions (
  id           bigint generated always as identity primary key,
  category     text not null check (length(category) between 1 and 40),
  prompt       text not null check (length(prompt) between 3 and 200),
  start_year   integer not null,
  start_value  double precision not null check (start_value > 0),
  end_year     integer not null,
  end_value    double precision not null check (end_value > 0),
  format       text not null check (format in ('big','int','usd','aud','sec','m','yrs','time','pct')),
  fact         text,
  source_name  text,
  source_url   text,
  source_url_2 text,
  region       text not null default 'global' check (region in ('global','AU','US','UK')),
  tags         text[] not null default '{}',
  status       text not null default 'draft' check (status in ('draft','flagged','verified','scheduled','used','retired')),
  verified_by  text,
  verified_at  timestamptz,
  checks       jsonb not null default '{}'::jsonb,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint questions_years_order check (end_year > start_year),
  -- Change must fit the slider: ÷1000 .. ×1000.
  constraint questions_change_in_range check (abs(log(end_value / start_value)) <= 3)
);
create index questions_status_idx on public.questions (status);

-- ---------------------------------------------------------------- puzzles
create table public.puzzles (
  puzzle_date date primary key,
  number      integer not null unique check (number >= 1),
  theme       text,
  status      text not null default 'draft' check (status in ('draft','ready')),
  -- Rerun fallback: serve the rounds of an earlier puzzle (DECISIONS item 2).
  rerun_of    date references public.puzzles (puzzle_date),
  created_at  timestamptz not null default now(),
  constraint puzzles_rerun_earlier check (rerun_of is null or rerun_of < puzzle_date)
);
create index puzzles_rerun_of_idx on public.puzzles (rerun_of);

create table public.puzzle_rounds (
  puzzle_date date not null references public.puzzles (puzzle_date) on delete cascade,
  position    smallint not null check (position between 1 and 5),
  question_id bigint not null references public.questions (id),
  primary key (puzzle_date, position),
  -- A question appears in at most one puzzle.
  constraint puzzle_rounds_question_once unique (question_id)
);

-- ---------------------------------------------------------------- plays + guesses
create table public.plays (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players (id) on delete cascade,
  puzzle_date  date not null references public.puzzles (puzzle_date),
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  total        smallint check (total between 0 and 500),
  tz_at_play   text,
  -- 'local' = played in offline fallback and synced later; excluded from crowd stats (DECISIONS item 7).
  source       text not null default 'server' check (source in ('server','local')),
  constraint plays_one_per_puzzle unique (player_id, puzzle_date),
  constraint plays_complete_has_total check ((completed_at is null) = (total is null))
);
create index plays_puzzle_date_idx on public.plays (puzzle_date);

create table public.guesses (
  play_id     uuid not null references public.plays (id) on delete cascade,
  position    smallint not null check (position between 1 and 5),
  -- The question actually answered, so same-day swaps keep history right (DECISIONS item 8).
  question_id bigint not null references public.questions (id),
  guess_log   double precision not null check (guess_log between -3 and 3),
  points      smallint not null check (points between 0 and 100),
  tier        text not null check (tier in ('nailed','close','meh','off','wrong')),
  wrong_way   boolean not null,
  created_at  timestamptz not null default now(),
  primary key (play_id, position),
  constraint guesses_wrong_way_tier check (wrong_way = (tier = 'wrong'))
);
create index guesses_question_id_idx on public.guesses (question_id);

-- Guesses are insert-only (SPEC §6): block updates outright.
create function private.forbid_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% rows are insert-only', tg_table_name using errcode = 'P0001';
end;
$$;

create trigger guesses_insert_only
  before update on public.guesses
  for each row execute function private.forbid_update();

-- ---------------------------------------------------------------- round stats
-- Raw counters are updated incrementally on each guess (and recomputed nightly);
-- the averages and percentages are derived columns.
create table public.round_stats (
  puzzle_date   date not null references public.puzzles (puzzle_date) on delete cascade,
  position      smallint not null check (position between 1 and 5),
  n             integer not null default 0 check (n >= 0),
  sum_points    integer not null default 0 check (sum_points >= 0),
  n_wrong_way   integer not null default 0 check (n_wrong_way >= 0),
  n_nailed      integer not null default 0 check (n_nailed >= 0),
  -- 24 buckets over the guess range [-3, 3] (0.25 each).
  histogram     integer[] not null default array_fill(0, array[24]),
  avg_points    real generated always as (case when n = 0 then null else sum_points::real / n end) stored,
  pct_wrong_way real generated always as (case when n = 0 then null else 100 * n_wrong_way::real / n end) stored,
  pct_nailed    real generated always as (case when n = 0 then null else 100 * n_nailed::real / n end) stored,
  updated_at    timestamptz not null default now(),
  primary key (puzzle_date, position),
  constraint round_stats_histogram_len check (cardinality(histogram) = 24)
);

-- ---------------------------------------------------------------- merge tokens (M4)
create table public.merge_tokens (
  -- SHA-256 of the token; the token itself is never stored.
  token_hash   text primary key,
  anon_user_id uuid not null references auth.users (id) on delete cascade,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index merge_tokens_anon_user_id_idx on public.merge_tokens (anon_user_id);

-- ---------------------------------------------------------------- question edits (audit)
create table public.question_edits (
  id          bigint generated always as identity primary key,
  question_id bigint not null references public.questions (id) on delete cascade,
  edited_by   text not null,
  edited_at   timestamptz not null default now(),
  before      jsonb,
  after       jsonb,
  note        text
);
create index question_edits_question_id_idx on public.question_edits (question_id);

-- ---------------------------------------------------------------- reports (M5, DECISIONS item 4)
create table public.reports (
  id          bigint generated always as identity primary key,
  question_id bigint not null references public.questions (id) on delete cascade,
  puzzle_date date not null references public.puzzles (puzzle_date),
  position    smallint not null check (position between 1 and 5),
  player_id   uuid not null references public.players (id) on delete cascade,
  reason      text not null check (reason in ('number','year','fact','other')),
  note        text check (length(note) <= 500),
  valid       boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint reports_one_per_player unique (player_id, question_id)
);
create index reports_question_id_idx on public.reports (question_id);
create index reports_puzzle_date_idx on public.reports (puzzle_date);

-- ---------------------------------------------------------------- updated_at
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger questions_touch before update on public.questions
  for each row execute function private.touch_updated_at();
create trigger round_stats_touch before update on public.round_stats
  for each row execute function private.touch_updated_at();
