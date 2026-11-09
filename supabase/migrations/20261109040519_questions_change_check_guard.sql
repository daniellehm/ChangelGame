-- The ×1000 range check divided by start_value before the "> 0" checks ran
-- (Postgres doesn't order CHECK evaluation), so 0 raised division_by_zero
-- instead of a clean check_violation. CASE guarantees evaluation order.
alter table public.questions drop constraint questions_change_in_range;
alter table public.questions add constraint questions_change_in_range check (
  case when start_value > 0 and end_value > 0
       then abs(log(end_value / start_value)) <= 3
       else false
  end
);
