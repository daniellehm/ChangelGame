-- M5 task 5.1: content pipeline tables (SPEC §8; DECISIONS 2026-11-09 "M5 pipeline").
-- All server-only: RLS on, no policies, service role only (default privileges from rls_and_grants).

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------- questions: pipeline columns
alter table public.questions
  add column origin text not null default 'manual' check (origin in ('seed','data','researched','manual')),
  -- Why the automatic checks held it back (status 'flagged').
  add column flag_reason text,
  -- Set when a live or past question is edited: the reveal shows a "Corrected" note (SPEC §8).
  add column corrected_at timestamptz,
  -- Report rate when an admin dismissed the report queue entry; re-queues only 10 points higher.
  add column reports_dismissed_rate double precision check (reports_dismissed_rate between 0 and 1),
  -- Data-backed provenance: dataset, series, entity, years and fetched values.
  add column source_data jsonb;

update public.questions set origin = 'seed' where 'prototype' = any (tags);

create index questions_prompt_trgm_idx on public.questions using gin (prompt extensions.gin_trgm_ops);

-- Duplicate check: questions whose prompt is similar to p_prompt (trigram similarity).
create function public.similar_questions(p_prompt text, p_min real, p_exclude bigint default null)
returns table (id bigint, prompt text, similarity real)
language sql
stable
set search_path = ''
as $$
  select q.id, q.prompt, extensions.similarity(q.prompt, p_prompt) as similarity
  from public.questions q
  where (p_exclude is null or q.id <> p_exclude)
    and extensions.similarity(q.prompt, p_prompt) > p_min
  order by 3 desc
  limit 5;
$$;

-- ---------------------------------------------------------------- reports: why a report didn't count
alter table public.reports add column invalid_reason text;

-- ---------------------------------------------------------------- content runs
create table public.content_runs (
  id          bigint generated always as identity primary key,
  trigger     text not null check (trigger in ('cron','manual','test')),
  status      text not null default 'running' check (status in ('running','done','failed','capped')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  -- A hop holds the lease while it works; another hop can't start until it expires.
  lease_until timestamptz,
  hops        integer not null default 0,
  generated   integer not null default 0,
  verified    integer not null default 0,
  flagged     integer not null default 0,
  scheduled   integer not null default 0,
  error       text,
  log         jsonb not null default '[]'::jsonb
);
create index content_runs_started_at_idx on public.content_runs (started_at desc);

-- Take the lease on a run if nobody holds it (atomic). Returns true when taken.
create function public.lease_content_run(p_run_id bigint, p_seconds integer)
returns boolean
language sql
volatile
set search_path = ''
as $$
  with taken as (
    update public.content_runs
       set lease_until = now() + make_interval(secs => p_seconds), hops = hops + 1
     where id = p_run_id and status = 'running' and (lease_until is null or lease_until < now())
     returning 1
  )
  select exists (select 1 from taken);
$$;

-- ---------------------------------------------------------------- Claude spend ledger
create table public.llm_calls (
  id                bigint generated always as identity primary key,
  run_id            bigint references public.content_runs (id) on delete set null,
  question_id       bigint references public.questions (id) on delete set null,
  purpose           text not null,
  model             text not null,
  input_tokens      integer not null default 0,
  output_tokens     integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  web_searches      integer not null default 0,
  cost_usd          numeric(10,5) not null default 0,
  ok                boolean not null default true,
  created_at        timestamptz not null default now()
);
create index llm_calls_created_at_idx on public.llm_calls (created_at);
create index llm_calls_run_id_idx on public.llm_calls (run_id);
create index llm_calls_question_id_idx on public.llm_calls (question_id);

-- Spend since a moment (the month's spend for the cap and the Health page).
create function public.llm_spend_since(p_since timestamptz)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(cost_usd), 0) from public.llm_calls where created_at >= p_since;
$$;

-- ---------------------------------------------------------------- alert emails sent (dedupe)
create table public.alerts_sent (
  id      bigint generated always as identity primary key,
  kind    text not null,
  sent_at timestamptz not null default now(),
  details jsonb
);
create index alerts_sent_kind_idx on public.alerts_sent (kind, sent_at desc);

-- ---------------------------------------------------------------- access
alter table public.content_runs enable row level security;
alter table public.llm_calls    enable row level security;
alter table public.alerts_sent  enable row level security;
revoke all on public.content_runs, public.llm_calls, public.alerts_sent from anon, authenticated;
revoke truncate, references, trigger on public.content_runs, public.llm_calls, public.alerts_sent from service_role;

revoke all on function public.similar_questions(text, real, bigint) from public, anon, authenticated;
revoke all on function public.lease_content_run(bigint, integer) from public, anon, authenticated;
revoke all on function public.llm_spend_since(timestamptz) from public, anon, authenticated;
grant execute on function public.similar_questions(text, real, bigint) to service_role;
grant execute on function public.lease_content_run(bigint, integer) to service_role;
grant execute on function public.llm_spend_since(timestamptz) to service_role;
