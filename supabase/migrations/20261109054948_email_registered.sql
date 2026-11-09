-- M4: does a permanent (non-anonymous) account already use this email?
-- Server-only (service_role); the API never reveals the answer to clients.
create function public.email_registered(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where lower(u.email) = lower(trim(p_email)) and coalesce(u.is_anonymous, false) = false
  );
$$;

revoke all on function public.email_registered(text) from public, anon, authenticated;
grant execute on function public.email_registered(text) to service_role;
