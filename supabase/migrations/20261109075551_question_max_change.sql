-- Symmetric guess ranges (DECISIONS 2026-11-09, revised): the slider runs
-- ÷max_change … ×max_change, always centred on "no change" so its shape never
-- hints at the direction. Replaces min_end_value/max_end_value (left in place,
-- unused, until Dani OKs dropping them). Mirrors lib/range.ts rangeProblems().
alter table public.questions add column max_change double precision;

alter table public.questions add constraint questions_max_change_sane check (
  case
    when max_change is null then true
    when max_change < 1.05 - 1e-12 or max_change > 1000 + 1e-9 then false
    -- the answer is at most 85% of the way from "same" to the end
    else abs(log(end_value / start_value)) <= 0.85 * log(max_change) + 1e-12
  end
);

-- The asymmetric rules no longer apply.
alter table public.questions drop constraint questions_range_sane;
alter table public.questions drop constraint questions_range_required;

-- Anything past draft review must have a range.
alter table public.questions add constraint questions_max_change_required check (
  status in ('draft', 'flagged', 'retired') or max_change is not null
);

comment on column public.questions.max_change is 'Biggest plausible change either way: the slider runs ÷max_change … ×max_change. See lib/range.ts.';
comment on column public.questions.min_end_value is 'UNUSED (superseded by max_change). Drop once approved.';
comment on column public.questions.max_end_value is 'UNUSED (superseded by max_change). Drop once approved.';
