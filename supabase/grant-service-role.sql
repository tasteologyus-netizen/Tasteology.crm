-- Run this once in Supabase → SQL Editor.
-- Fixes "permission denied for table leads" for server APIs that use
-- SUPABASE_SECRET_KEY (service_role), which bypasses RLS but still needs
-- table-level GRANTs.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
