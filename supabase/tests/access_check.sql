-- Access model check (M2 task 2.3). Read-only; run with the Supabase MCP execute_sql.
-- Expected: anon = nothing on every table; authenticated = select on players,
-- plays, guesses only; service_role = select,insert,update,delete (no TRUNCATE).
with t as (
  select c.relname as tbl from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
), r(role) as (values ('anon'), ('authenticated'), ('service_role'))
select t.tbl, r.role,
  concat_ws(',',
    case when has_table_privilege(r.role, 'public.' || t.tbl, 'SELECT') then 'select' end,
    case when has_table_privilege(r.role, 'public.' || t.tbl, 'INSERT') then 'insert' end,
    case when has_table_privilege(r.role, 'public.' || t.tbl, 'UPDATE') then 'update' end,
    case when has_table_privilege(r.role, 'public.' || t.tbl, 'DELETE') then 'delete' end,
    case when has_table_privilege(r.role, 'public.' || t.tbl, 'TRUNCATE') then 'TRUNCATE' end
  ) as privileges
from t cross join r
order by t.tbl, r.role;
-- Also check end to end: GET /rest/v1/<table> with the publishable key must return 42501.
