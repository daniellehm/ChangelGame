-- Least privilege: the server never needs TRUNCATE/REFERENCES/TRIGGER on app tables.
revoke truncate, references, trigger on all tables in schema public from service_role;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from service_role;
