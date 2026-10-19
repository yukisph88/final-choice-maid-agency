-- 0006 — live availability for the file-based PUBLIC website (GitHub Pages)                                  run once in the Supabase SQL Editor
--
-- The public website keeps its profile text, photos and PDFs in GitHub files. It only asks the database one question:
-- "what is the confirmed availability of these reference codes?"  This migration adds the smallest safe way to answer it.
--
--  • public_site_listing   a plain list of reference codes that already appear on the public website (set by an administrator / office script).
--                          It is NOT publication: it publishes nothing, it only says "this code is already public via the website files".
--                          The maids' own `published` flag, consent and everything else in the database are not touched.
--  • public_site_status()  read-only. For listed codes ONLY it returns: reference code, availability, and when staff verified it.
--                          Anything staff have not confirmed is returned as 'to-be-confirmed' (with no timestamp).
--                          It never returns names, notes, ages, salaries, documents, photo paths or staff details,
--                          and nothing at all for a code that is not on the list.
--
-- It replaces nothing: public_maids() / public_maid_status() (database-published profiles) are unchanged.
-- This script only ADDS one table and one function; it deletes nothing. Safe to run more than once.

create table if not exists public.public_site_listing (
  code      text primary key references public.maids (code) on delete cascade on update cascade,
  listed_at timestamptz not null default now(),
  listed_by uuid default auth.uid()
);
comment on table public.public_site_listing is 'Reference codes already shown on the public GitHub website (file-based). Controls which codes public_site_status() may answer for. Not a publication flag.';

alter table public.public_site_listing enable row level security;
revoke all on public.public_site_listing from anon;
grant select, insert, delete on public.public_site_listing to authenticated;
grant all on public.public_site_listing to service_role;
drop policy if exists site_listing_read on public.public_site_listing;
create policy site_listing_read on public.public_site_listing for select to authenticated using (public.is_staff());
drop policy if exists site_listing_insert on public.public_site_listing;
create policy site_listing_insert on public.public_site_listing for insert to authenticated with check (public.is_admin());
drop policy if exists site_listing_delete on public.public_site_listing;
create policy site_listing_delete on public.public_site_listing for delete to authenticated using (public.is_admin());

create or replace function public.public_site_status()
returns table (code text, status text, verified_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.code,
         case when m.status_confirmed and m.status <> 'to-be-confirmed' then m.status else 'to-be-confirmed' end,
         case when m.status_confirmed and m.status <> 'to-be-confirmed' then coalesce(m.status_verified_at, m.status_updated_at) end
  from public.maids m
  join public.public_site_listing l on l.code = m.code
$$;
revoke all on function public.public_site_status() from public;
grant execute on function public.public_site_status() to anon, authenticated, service_role;
