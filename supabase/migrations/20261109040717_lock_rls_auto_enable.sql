-- Supabase's "automatic RLS" event-trigger function was executable by anon/authenticated
-- via /rest/v1/rpc (advisor 0028/0029). It can only run as an event trigger, which
-- executes as its owner, so revoking client EXECUTE changes nothing functionally.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
