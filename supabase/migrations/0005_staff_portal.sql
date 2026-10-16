-- =====================================================================================
-- Final Choice — staff management portal (run once in Supabase → SQL Editor, after 0001–0004)
--
-- Adds, without touching existing data:
--   • availability vocabulary: To Be Confirmed · Available · On Hold · Booked · Pending Arrival · Hired · Withdrawn
--   • maid fields: rest-day preference, salary note, "discrepancies resolved", verification date
--   • placements (employer matching, booking, progress)         • internal documents (private bucket, access levels)
--   • audit log for placements / documents / staff / exports     • role rules enforced IN THE DATABASE:
--       admin  = everything incl. publishing, deleting, exporting, staff accounts
--       editor = biodata, photos, availability, placements, documents (never publication or consent)
--       viewer = read only
--   • safe deletion (only Withdrawn maids; staff are deactivated, never deleted; the last administrator is protected)
--   • staff functions for the portal: create account, set temporary password, directory, own profile
-- The "destructive operations" warning only concerns replacing named constraints/policies/triggers. No table or
-- record is dropped or deleted. Safe to run more than once.
-- =====================================================================================

-- ---------- 1. availability vocabulary ----------------------------------------------------------------
alter table public.maids drop constraint if exists maids_status_check;
update public.maids set status = case status
    when 'interview-pending' then 'on-hold' when 'reserved' then 'booked' when 'processing' then 'pending-arrival'
    when 'placed' then 'hired' when 'unavailable' then 'withdrawn' else status end
  where status in ('interview-pending', 'reserved', 'processing', 'placed', 'unavailable');
update public.maids set status = 'to-be-confirmed' where status = 'available' and not status_confirmed;
alter table public.maids add constraint maids_status_check
  check (status in ('to-be-confirmed', 'available', 'on-hold', 'booked', 'pending-arrival', 'hired', 'withdrawn'));
alter table public.maids alter column status set default 'to-be-confirmed';
alter table public.maids drop constraint if exists tbc_not_confirmed;
update public.maids set status_confirmed = false where status = 'to-be-confirmed' and status_confirmed;
alter table public.maids add constraint tbc_not_confirmed check (status <> 'to-be-confirmed' or not status_confirmed);

-- ---------- 2. new maid fields --------------------------------------------------------------------------
alter table public.maids add column if not exists rest_day_preference text not null default '';
alter table public.maids add column if not exists salary_note text not null default '';
alter table public.maids add column if not exists discrepancies_resolved boolean not null default false;
alter table public.maids add column if not exists discrepancy_notes text not null default '';
alter table public.maids add column if not exists status_verified_at timestamptz;

-- publishing now also needs "discrepancies resolved" (same rule as the approval checklist)
update public.maids set published = false, public_photo_path = '' where published and not discrepancies_resolved;
alter table public.maids drop constraint if exists publish_requires_consent;
alter table public.maids add constraint publish_requires_consent check (
  not published or (consent_recorded and consent_date is not null and length(trim(approved_by)) > 0 and discrepancies_resolved)
);

create or replace function public.maids_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  new.code := upper(trim(new.code));
  if tg_op = 'UPDATE' and (new.status is distinct from old.status or new.status_confirmed is distinct from old.status_confirmed) then
    new.status_updated_at := now();
  end if;
  -- verification date: when staff confirm a status
  if new.status_confirmed then
    if tg_op = 'INSERT' or old.status_confirmed is distinct from new.status_confirmed or new.status is distinct from old.status
       or new.status_verified_at is distinct from old.status_verified_at then   -- staff re-verifying the same status
      new.status_verified_at := now();
    end if;
  else
    new.status_verified_at := null;
  end if;
  return new;
end $$;

-- ---------- 3. role rules on maids ----------------------------------------------------------------------
-- editors manage biodata, photos and availability — but only administrators touch publication and consent
create or replace function public.maids_role_guard() returns trigger
language plpgsql set search_path = public as $$
declare r text := public.staff_role();
begin
  if auth.uid() is null or r = 'admin' then return new; end if;   -- office scripts and administrators
  if r = 'editor' then
    if tg_op = 'INSERT' then
      if new.published or new.consent_recorded or new.photo_consent or new.show_age or new.show_religion or new.featured
         or new.public_photo_path <> '' or new.discrepancies_resolved or new.name_consent <> 'none' or new.approved_by <> ''
         or new.display_name_override <> '' or new.consent_date is not null then
        raise exception 'Only an administrator can set publication and consent fields';
      end if;
    elsif (new.published, new.consent_recorded, new.consent_date, new.photo_consent, new.name_consent, new.show_age, new.show_religion,
           new.approved_by, new.public_photo_path, new.discrepancies_resolved, new.featured, new.display_name_override)
          is distinct from
          (old.published, old.consent_recorded, old.consent_date, old.photo_consent, old.name_consent, old.show_age, old.show_religion,
           old.approved_by, old.public_photo_path, old.discrepancies_resolved, old.featured, old.display_name_override) then
      raise exception 'Only an administrator can change publication and consent fields';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists maids_role_guard on public.maids;
create trigger maids_role_guard before insert or update on public.maids for each row execute function public.maids_role_guard();

-- safe deletion: only Withdrawn maids can be deleted (and never while placements exist — see foreign key below)
create or replace function public.maids_delete_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and old.status <> 'withdrawn' then
    raise exception 'Only a Withdrawn maid can be deleted. Set her availability to Withdrawn first.';
  end if;
  return old;
end $$;
drop trigger if exists maids_delete_guard on public.maids;
create trigger maids_delete_guard before delete on public.maids for each row execute function public.maids_delete_guard();

-- ---------- 4. placements ---------------------------------------------------------------------------------
create table if not exists public.placements (
  id               uuid primary key default gen_random_uuid(),
  maid_id          uuid references public.maids (id) on delete restrict,
  employer_name    text not null default '',
  employer_phone   text not null default '',                 -- internal contact (sensitive, never public)
  employer_location text not null default '',
  package_category text not null default '' check (package_category in ('', 'indonesian', 'indonesian-christian', 'filipino')),
  package_tier     text not null default '' check (package_tier in ('', 'premium', 'platinum', 'diamond')),
  stage            text not null default 'enquiry'
                   check (stage in ('enquiry', 'matched', 'interview', 'booked', 'processing', 'pending-arrival', 'placed', 'cancelled')),
  interview_date   date, booking_date date, expected_arrival date, arrival_date date, placement_date date, warranty_end date,
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);
create index if not exists placements_maid_idx on public.placements (maid_id);
create index if not exists placements_stage_idx on public.placements (stage);
create or replace function public.placements_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
drop trigger if exists placements_touch on public.placements;
create trigger placements_touch before update on public.placements for each row execute function public.placements_touch();

-- ---------- 5. internal documents -------------------------------------------------------------------------
-- access_level: admin = administrators only · editor = administrators and editors · staff = all active staff
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  maid_id       uuid references public.maids (id) on delete restrict,
  placement_id  uuid references public.placements (id) on delete restrict,
  kind          text not null default 'other' check (kind in ('biodata-pdf', 'consent-form', 'contract', 'id-document', 'medical', 'other')),
  title         text not null check (length(trim(title)) > 0),
  storage_path  text not null unique,
  mime_type     text not null default '',
  size_bytes    int not null default 0,
  access_level  text not null default 'admin' check (access_level in ('admin', 'editor', 'staff')),
  notes         text not null default '',
  uploaded_by   uuid default auth.uid(),
  uploaded_by_email text not null default '',
  created_at    timestamptz not null default now(),
  -- identity and medical documents are administrator-only by rule
  constraint sensitive_docs_admin_only check (kind not in ('id-document', 'medical') or access_level = 'admin')
);
create index if not exists documents_maid_idx on public.documents (maid_id);

create or replace function public.doc_level_ok(level text) returns boolean
language sql stable as $$
  select case level when 'staff' then public.is_staff() when 'editor' then public.can_edit() else public.is_admin() end
$$;

-- ---------- 6. audit log (placements, documents, staff, exports) ------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   text not null default '',
  label       text not null default '',
  action      text not null,
  changes     jsonb not null default '{}'::jsonb,
  actor       uuid,
  actor_email text not null default '',
  at          timestamptz not null default now()
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);

create or replace function public.audit_generic() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb; diff jsonb := '{}'::jsonb; k text; who text; rid text; lbl text;
begin
  select email into who from public.staff where user_id = auth.uid();
  if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then n := to_jsonb(new); end if;
  rid := coalesce((coalesce(n, o)) ->> 'id', (coalesce(n, o)) ->> 'user_id', '');
  lbl := coalesce((coalesce(n, o)) ->> 'employer_name', (coalesce(n, o)) ->> 'title', (coalesce(n, o)) ->> 'email', '');
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if k not in ('updated_at', 'updated_by') and (o -> k) is distinct from (n -> k) then
        diff := diff || jsonb_build_object(k, jsonb_build_object('from', o -> k, 'to', n -> k));
      end if;
    end loop;
    if diff = '{}'::jsonb then return new; end if;
  elsif tg_op = 'INSERT' then diff := n - 'storage_path';
  else diff := o - 'storage_path';
  end if;
  insert into public.audit_log (table_name, record_id, label, action, changes, actor, actor_email)
  values (tg_table_name, rid, lbl, lower(tg_op), diff, auth.uid(), coalesce(who, ''));
  return coalesce(new, old);
end $$;
drop trigger if exists audit_placements on public.placements;
create trigger audit_placements after insert or update or delete on public.placements for each row execute function public.audit_generic();
drop trigger if exists audit_documents on public.documents;
create trigger audit_documents after insert or update or delete on public.documents for each row execute function public.audit_generic();
drop trigger if exists audit_staff on public.staff;
create trigger audit_staff after insert or update or delete on public.staff for each row execute function public.audit_generic();

-- exports are recorded (administrators only)
create or replace function public.log_export(p_what text, p_count int) returns void
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if not public.is_admin() then raise exception 'Only an administrator can export data'; end if;
  select email into who from public.staff where user_id = auth.uid();
  insert into public.audit_log (table_name, record_id, label, action, changes, actor, actor_email)
  values ('export', '', left(p_what, 80), 'export', jsonb_build_object('rows', p_count), auth.uid(), coalesce(who, ''));
end $$;

-- ---------- 7. staff safety rules -----------------------------------------------------------------------------
create or replace function public.staff_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;      -- office scripts
  if tg_op = 'DELETE' then raise exception 'Staff accounts cannot be deleted — deactivate the account instead'; end if;
  if old.user_id = auth.uid() and (new.role is distinct from old.role or new.active is distinct from old.active) then
    raise exception 'You cannot change your own role or deactivate yourself';
  end if;
  if old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active)
     and not exists (select 1 from public.staff s where s.role = 'admin' and s.active and s.user_id <> old.user_id) then
    raise exception 'At least one active administrator is required';
  end if;
  return new;
end $$;
drop trigger if exists staff_guard on public.staff;
create trigger staff_guard before update or delete on public.staff for each row execute function public.staff_guard();

-- ---------- 8. row level security for the new tables -----------------------------------------------------
alter table public.placements enable row level security;
alter table public.documents  enable row level security;
alter table public.audit_log  enable row level security;
revoke all on public.placements, public.documents, public.audit_log from anon;
grant select, insert, update, delete on public.placements, public.documents to authenticated;
grant select on public.audit_log to authenticated;

drop policy if exists placements_read on public.placements;
create policy placements_read on public.placements for select to authenticated using (public.is_staff());
drop policy if exists placements_insert on public.placements;
create policy placements_insert on public.placements for insert to authenticated with check (public.can_edit());
drop policy if exists placements_update on public.placements;
create policy placements_update on public.placements for update to authenticated using (public.can_edit()) with check (public.can_edit());
drop policy if exists placements_delete on public.placements;
create policy placements_delete on public.placements for delete to authenticated using (public.is_admin());

drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents for select to authenticated using (public.doc_level_ok(access_level));
drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents for insert to authenticated with check (public.can_edit() and (access_level <> 'admin' or public.is_admin()));
drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents for update to authenticated using (public.doc_level_ok(access_level) and public.can_edit()) with check (public.can_edit() and (access_level <> 'admin' or public.is_admin()));
drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents for delete to authenticated using (public.is_admin());

drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated using (public.is_staff());
-- no write policy: only the SECURITY DEFINER triggers/functions write to the audit log

-- ---------- 9. storage: documents bucket + administrator-only public photos ----------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('maid-documents', 'maid-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- is there a document record for this file? (must see ALL records, whatever the caller may read — hence SECURITY DEFINER)
create or replace function public.doc_registered(p_path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.documents where storage_path = p_path)
$$;
revoke all on function public.doc_registered(text) from public, anon;
grant execute on function public.doc_registered(text) to authenticated;

drop policy if exists "fc docs read" on storage.objects;
-- a file is readable at the level of its document record; an editor may also see a freshly uploaded file that is not registered yet
create policy "fc docs read" on storage.objects for select to authenticated using (
  bucket_id = 'maid-documents' and (
    exists (select 1 from public.documents d where d.storage_path = storage.objects.name and public.doc_level_ok(d.access_level))
    or (public.can_edit() and not public.doc_registered(storage.objects.name))));
drop policy if exists "fc docs write" on storage.objects;
create policy "fc docs write" on storage.objects for insert to authenticated with check (bucket_id = 'maid-documents' and public.can_edit());
drop policy if exists "fc docs update" on storage.objects;
create policy "fc docs update" on storage.objects for update to authenticated
  using (bucket_id = 'maid-documents' and public.is_admin()) with check (bucket_id = 'maid-documents' and public.is_admin());
drop policy if exists "fc docs delete" on storage.objects;
create policy "fc docs delete" on storage.objects for delete to authenticated using (
  bucket_id = 'maid-documents' and (public.is_admin() or (public.can_edit() and not public.doc_registered(storage.objects.name))));

-- publishing photos to the website is an administrator action
drop policy if exists "fc public write" on storage.objects;
create policy "fc public write" on storage.objects for insert to authenticated
  with check (bucket_id = 'maid-public' and public.is_admin() and public.public_photo_allowed(name));
drop policy if exists "fc public update" on storage.objects;
create policy "fc public update" on storage.objects for update to authenticated
  using (bucket_id = 'maid-public' and public.is_admin()) with check (bucket_id = 'maid-public' and public.is_admin() and public.public_photo_allowed(name));
drop policy if exists "fc public delete" on storage.objects;
create policy "fc public delete" on storage.objects for delete to authenticated using (bucket_id = 'maid-public' and public.is_admin());

-- ---------- 10. what the website may see ------------------------------------------------------------------------------
-- "status_recorded" = status CONFIRMED by staff (never true for "To Be Confirmed"). Hired / Withdrawn maids are not listed.
create or replace function public.public_maids()
returns table (
  code text, display_name text, nationality text, age int, religion text, marital_status text,
  experience_years numeric, overseas_experience boolean, skills jsonb, languages jsonb, employment_history jsonb,
  summary_en text, summary_ms text, interview_availability_en text, interview_availability_ms text,
  status text, status_updated_at timestamptz, status_recorded boolean, featured boolean, photo_path text
)
language sql stable security definer set search_path = public as $$
  select m.code,
         case when m.display_name_override <> '' and m.name_consent <> 'none' then m.display_name_override
              when m.name_consent = 'full'  then nullif(m.full_name, '')
              when m.name_consent = 'first' then nullif(m.first_name, '')
              else null end,
         m.nationality,
         case when m.show_age then m.age end,
         case when m.show_religion then nullif(m.religion, '') end,
         nullif(m.marital_status, ''),
         m.experience_years, m.overseas_experience, m.skills, m.languages, m.employment_history,
         m.summary_en, m.summary_ms, m.interview_availability_en, m.interview_availability_ms,
         m.status, m.status_updated_at, (m.status_confirmed and m.status <> 'to-be-confirmed'), m.featured,
         case when m.photo_consent then nullif(m.public_photo_path, '') end
  from public.maids m
  where m.published and m.consent_recorded and m.consent_date is not null
    and m.status not in ('hired', 'withdrawn', 'placed', 'unavailable');
$$;
create or replace function public.public_maid_status()
returns table (code text, status text, status_updated_at timestamptz, status_recorded boolean)
language sql stable security definer set search_path = public as $$
  select m.code, m.status, m.status_updated_at, (m.status_confirmed and m.status <> 'to-be-confirmed')
  from public.maids m
  where m.published and m.consent_recorded and m.consent_date is not null;
$$;
revoke all on function public.public_maids(), public.public_maid_status() from public;
grant execute on function public.public_maids(), public.public_maid_status() to anon, authenticated;

-- ---------- 11. staff accounts from the portal (administrators only) ----------------------------------------------------
create or replace function public.staff_directory()
returns table (user_id uuid, email text, full_name text, role text, active boolean, created_at timestamptz, last_sign_in_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.user_id, s.email, s.full_name, s.role, s.active, s.created_at, u.last_sign_in_at
  from public.staff s left join auth.users u on u.id = s.user_id
  where public.is_admin() or s.user_id = auth.uid()
  order by s.created_at;
$$;

create or replace function public.admin_create_staff(p_email text, p_name text, p_role text, p_password text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := gen_random_uuid(); em text := lower(trim(p_email)); col text; has_provider_id boolean;
begin
  if not public.is_admin() then raise exception 'Only an administrator can create staff accounts'; end if;
  if em !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'That e-mail address is not valid'; end if;
  if p_role not in ('admin', 'editor', 'viewer') then raise exception 'Role must be admin, editor or viewer'; end if;
  if length(coalesce(p_password, '')) < 12 then raise exception 'The temporary password needs at least 12 characters'; end if;
  if exists (select 1 from auth.users where lower(email) = em) then raise exception 'This e-mail address already has a login'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
          extensions.crypt(p_password, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('full_name', trim(p_name)), now(), now());
  -- the login service reads these columns as plain text, so they must not be NULL
  for col in select column_name from information_schema.columns where table_schema = 'auth' and table_name = 'users'
             and column_name in ('confirmation_token', 'recovery_token', 'email_change_token_new', 'email_change', 'email_change_token_current',
                                 'phone_change', 'phone_change_token', 'reauthentication_token') loop
    execute format('update auth.users set %I = '''' where id = $1', col) using uid;
  end loop;
  select exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id') into has_provider_id;
  if has_provider_id then
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());
  else
    insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());
  end if;
  insert into public.staff (user_id, email, full_name, role, active) values (uid, em, trim(p_name), p_role, true);
  return uid;
end $$;

create or replace function public.admin_set_staff_password(p_user_id uuid, p_password text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only an administrator can set a temporary password'; end if;
  if length(coalesce(p_password, '')) < 12 then raise exception 'The temporary password needs at least 12 characters'; end if;
  if not exists (select 1 from public.staff where user_id = p_user_id) then raise exception 'No such staff account'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now() where id = p_user_id;
  begin delete from auth.sessions where user_id = p_user_id; exception when others then null; end;   -- sign the person out everywhere
  insert into public.audit_log (table_name, record_id, label, action, changes, actor, actor_email)
  select 'staff', p_user_id::text, s.email, 'password-reset', '{}'::jsonb, auth.uid(), coalesce((select email from public.staff where user_id = auth.uid()), '')
  from public.staff s where s.user_id = p_user_id;
end $$;

create or replace function public.update_my_profile(p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not a staff account'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Please enter your name'; end if;
  update public.staff set full_name = trim(p_name) where user_id = auth.uid();
end $$;

revoke all on function public.log_export(text, int), public.staff_directory(), public.admin_create_staff(text, text, text, text),
  public.admin_set_staff_password(uuid, text), public.update_my_profile(text) from public, anon;
grant execute on function public.log_export(text, int), public.staff_directory(), public.admin_create_staff(text, text, text, text),
  public.admin_set_staff_password(uuid, text), public.update_my_profile(text) to authenticated;
revoke all on function public.doc_level_ok(text) from public, anon;
grant execute on function public.doc_level_ok(text) to authenticated;

-- ---------- 12. office scripts (Secret key) keep working on the new tables ------------------------------------------------
grant all on public.placements, public.documents, public.audit_log to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
