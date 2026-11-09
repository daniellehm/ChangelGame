-- Schema constraint tests (M2 task 2.2). Run with the Supabase MCP execute_sql.
-- One DO block that always ends by raising, so every test row is rolled back.
-- Success = error 'SCHEMA_TESTS_PASSED (15 checks)'. Any 'FAIL: …' is a real failure.
--
-- Not covered here (needs a real auth user; Claude Code's permission check blocks
-- writing to auth.users from SQL): the players trigger, account-delete cascade,
-- one play per puzzle, insert-only guesses, and the guess tier/wrong-way checks.
-- Those are covered by the M3 integration tests with real anonymous sign-ins.
do $$
declare
  ok int := 0;
  q1 bigint; q2 bigint;
  rs record;
begin
  begin insert into public.questions (category,prompt,start_year,start_value,end_year,end_value,format) values ('X','Bad start',2000,0,2010,5,'int');
    raise exception 'FAIL: start_value 0 accepted'; exception when check_violation then ok := ok + 1; end;
  begin insert into public.questions (category,prompt,start_year,start_value,end_year,end_value,format) values ('X','Neg end',2000,1,2010,-5,'int');
    raise exception 'FAIL: negative end_value accepted'; exception when check_violation then ok := ok + 1; end;
  begin insert into public.questions (category,prompt,start_year,start_value,end_year,end_value,format) values ('X','Bad years',2010,1,2010,5,'int');
    raise exception 'FAIL: end_year = start_year accepted'; exception when check_violation then ok := ok + 1; end;
  begin insert into public.questions (category,prompt,start_year,start_value,end_year,end_value,format) values ('X','Too big',2000,1,2010,1001,'int');
    raise exception 'FAIL: >1000x change accepted'; exception when check_violation then ok := ok + 1; end;
  begin insert into public.questions (category,prompt,start_year,start_value,end_year,end_value,format) values ('X','Too small',2000,1001,2010,1,'int');
    raise exception 'FAIL: <1/1000 change accepted'; exception when check_violation then ok := ok + 1; end;
  begin insert into public.questions (category,prompt,start_year,start_value,end_year,end_value,format) values ('X','Bad format',2000,1,2010,5,'gbp');
    raise exception 'FAIL: unknown format accepted'; exception when check_violation then ok := ok + 1; end;
  begin insert into public.questions (category,prompt,start_year,start_value,end_year,end_value,format,status) values ('X','Bad status',2000,1,2010,5,'int','live');
    raise exception 'FAIL: unknown status accepted'; exception when check_violation then ok := ok + 1; end;

  insert into public.questions (category,prompt,start_year,start_value,end_year,end_value,format,status)
    values ('X','Flagged ok',2000,1,2010,1000,'int','flagged') returning id into q1;
  insert into public.questions (category,prompt,start_year,start_value,end_year,end_value,format)
    values ('X','Second',2000,2,2010,3,'usd') returning id into q2;
  ok := ok + 1;

  insert into public.puzzles (puzzle_date, number, status) values ('2099-01-01', 99999, 'ready');
  insert into public.puzzles (puzzle_date, number, status) values ('2099-01-02', 99998, 'ready');
  insert into public.puzzle_rounds values ('2099-01-01', 1, q1);
  begin insert into public.puzzle_rounds values ('2099-01-02', 1, q1);
    raise exception 'FAIL: question reused in a second puzzle'; exception when unique_violation then ok := ok + 1; end;
  begin insert into public.puzzle_rounds values ('2099-01-01', 6, q2);
    raise exception 'FAIL: position 6 accepted'; exception when check_violation then ok := ok + 1; end;
  begin insert into public.puzzles (puzzle_date, number, rerun_of) values ('2099-01-03', 99997, '2099-01-04');
    raise exception 'FAIL: rerun of a later date accepted'; exception when check_violation or foreign_key_violation then ok := ok + 1; end;
  begin insert into public.puzzles (puzzle_date, number, status) values ('2099-01-05', 99996, 'live');
    raise exception 'FAIL: unknown puzzle status accepted'; exception when check_violation then ok := ok + 1; end;

  begin insert into public.players (id) values (gen_random_uuid());
    raise exception 'FAIL: player without auth user accepted'; exception when foreign_key_violation then ok := ok + 1; end;

  insert into public.round_stats (puzzle_date, position, n, sum_points, n_wrong_way, n_nailed) values ('2099-01-01', 1, 4, 250, 1, 2);
  select * into rs from public.round_stats where puzzle_date = '2099-01-01' and position = 1;
  if rs.avg_points <> 62.5 or rs.pct_wrong_way <> 25 or rs.pct_nailed <> 50 or cardinality(rs.histogram) <> 24 then
    raise exception 'FAIL: round_stats derived columns wrong: %', row_to_json(rs);
  end if;
  ok := ok + 1;

  begin insert into public.round_stats (puzzle_date, position, histogram) values ('2099-01-01', 2, array[1,2,3]);
    raise exception 'FAIL: short histogram accepted'; exception when check_violation then ok := ok + 1; end;

  raise exception 'SCHEMA_TESTS_PASSED (% checks)', ok;
end $$;
