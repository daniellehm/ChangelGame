-- Stable key so content/questions.csv can be re-imported idempotently.
alter table public.questions add column slug text;
alter table public.questions add constraint questions_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
alter table public.questions add constraint questions_slug_key unique (slug);

-- Puzzle number is derived from LAUNCH_DATE in the API (one source of truth); a
-- stored copy would go stale if the launch date moves (DECISIONS.md). The column
-- is kept (nullable, unused) rather than dropped.
alter table public.puzzles alter column number drop not null;
comment on column public.puzzles.number is 'Unused: the API derives the puzzle number from LAUNCH_DATE.';
