-- M2 task 2.3: access model (SPEC §6 "Row Level Security").
-- * Server routes use the service role (bypasses RLS) for everything.
-- * Signed-in players (incl. anonymous users, role "authenticated") may only
--   SELECT their own players / plays / guesses rows. No client writes.
-- * anon gets nothing. questions, puzzle_rounds, puzzles, round_stats,
--   merge_tokens, question_edits and reports have no client access at all.

-- Belt and braces: RLS on everywhere (auto-RLS already did this).
alter table public.players        enable row level security;
alter table public.questions      enable row level security;
alter table public.puzzles        enable row level security;
alter table public.puzzle_rounds  enable row level security;
alter table public.plays          enable row level security;
alter table public.guesses        enable row level security;
alter table public.round_stats    enable row level security;
alter table public.merge_tokens   enable row level security;
alter table public.question_edits enable row level security;
alter table public.reports        enable row level security;

-- Remove the default TRUNCATE/REFERENCES/TRIGGER/MAINTAIN grants (RLS doesn't govern TRUNCATE).
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Server (service role): full data access.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Players: read their own rows only.
grant select on public.players, public.plays, public.guesses to authenticated;

create policy "players: read own row" on public.players
  for select to authenticated
  using (id = (select auth.uid()));

create policy "plays: read own plays" on public.plays
  for select to authenticated
  using (player_id = (select auth.uid()));

create policy "guesses: read guesses on own plays" on public.guesses
  for select to authenticated
  using (exists (
    select 1 from public.plays p
    where p.id = guesses.play_id and p.player_id = (select auth.uid())
  ));

-- Index backing the guesses policy lookup is the plays PK; plays policy uses the
-- (player_id, puzzle_date) unique index.

-- Future tables created by postgres in public: same defaults (no client access,
-- full service-role access), so new migrations are safe by default.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public grant usage, select on sequences to service_role;

-- Internal functions live in private; make sure clients can't call them.
revoke all on all functions in schema private from public, anon, authenticated;
