-- Per-question guess ranges (DECISIONS 2026-11-09). The slider spans
-- min_end_value … max_end_value (plausible bounds for the end value, real units).
-- lib/range.ts rangeProblems() is the full rule set; this mirrors it so nothing
-- (importer, M5 pipeline, admin) can store a range the game can't play.
alter table public.questions
  add column min_end_value double precision,
  add column max_end_value double precision;

alter table public.questions add constraint questions_range_sane check (
  case
    when min_end_value is null and max_end_value is null then true
    when min_end_value is null or max_end_value is null then false
    when min_end_value <= 0 or max_end_value <= min_end_value then false
    else
      -- includes "no change"
      min_end_value < start_value and start_value < max_end_value
      -- width between ×1.0965 (log 0.04) and ×1,000,000 (log 6), with float slack
      and log(max_end_value / min_end_value) >= 0.04 - 1e-9
      and log(max_end_value / min_end_value) <= 6 + 1e-9
      -- the answer sits at least 10% in from both ends
      and log(end_value / min_end_value) >= 0.1 * log(max_end_value / min_end_value) - 1e-9
      and log(max_end_value / end_value) >= 0.1 * log(max_end_value / min_end_value) - 1e-9
  end
);

-- Anything past draft review must have a range.
alter table public.questions add constraint questions_range_required check (
  status in ('draft', 'flagged', 'retired') or (min_end_value is not null and max_end_value is not null)
);

comment on column public.questions.min_end_value is 'Slider left end: lowest plausible end value (real units). See lib/range.ts.';
comment on column public.questions.max_end_value is 'Slider right end: highest plausible end value (real units). See lib/range.ts.';
