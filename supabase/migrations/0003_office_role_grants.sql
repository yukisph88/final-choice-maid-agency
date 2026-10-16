-- Final Choice — let the office scripts (Secret / service_role key) use the maid tables.
-- Newer Supabase projects no longer grant table access to the service role automatically, so
-- db:migrate, db:backup, db:restore and the tests got "permission denied" (error 42501).
-- Only the OFFICE role is changed. Website visitors (anon) still have NO access to any table.
-- Adds permissions only; nothing is dropped or deleted. Safe to run more than once.

grant usage on schema public to service_role;
grant all on public.maids, public.maid_history, public.staff to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
