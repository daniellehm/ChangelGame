-- The first version of per-question ranges (min/max end values) was replaced by
-- the symmetric max_change. Dropped by Dani in the Supabase SQL editor on
-- 2026-11-09 (the MCP permission check declined it), so this version is not in
-- the remote migration history. `if exists` keeps it safe to re-run.
alter table public.questions drop column if exists min_end_value, drop column if exists max_end_value;
