-- Duplicate detection ignores retired questions: a retired near-copy shouldn't block a good question forever.
create or replace function public.similar_questions(p_prompt text, p_min real, p_exclude bigint default null)
returns table (id bigint, prompt text, similarity real)
language sql
stable
set search_path = ''
as $$
  select q.id, q.prompt, extensions.similarity(q.prompt, p_prompt) as similarity
  from public.questions q
  where (p_exclude is null or q.id <> p_exclude)
    and q.status <> 'retired'
    and extensions.similarity(q.prompt, p_prompt) > p_min
  order by 3 desc
  limit 5;
$$;

revoke all on function public.similar_questions(text, real, bigint) from public, anon, authenticated;
grant execute on function public.similar_questions(text, real, bigint) to service_role;
