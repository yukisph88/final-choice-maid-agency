-- =====================================================================================
-- Final Choice — maid biodata database (Supabase Free Plan)
--
-- Run once in Supabase → SQL Editor (or `npm run db:test` runs it locally against PGlite).
-- Safe to re-run: every object is created with IF NOT EXISTS / OR REPLACE.
--
-- SECURITY MODEL
--   • public.maids, public.maid_history, public.staff: Row Level Security ON.
--     Only signed-in, ACTIVE staff can read; editors/admins can change; admins manage staff.
--   • Website visitors (role "anon") can NOT read any table. They can only call
--       public.public_maids()        → approved, consented, active profiles (safe columns only)
--       public.public_maid_status()  → code + status of those same profiles (live availability)
--   • A profile can only be published when consent, consent date and approver are recorded
--     (database CHECK constraint — the dashboard cannot bypass it).
--   • Every insert / update / delete is written to public.maid_history by a trigger.
--   • Storage: "maid-private" (private: photos, biodata PDFs) and "maid-public" (approved photos
--     only; uploads allowed only for published maids with photo consent).
-- =====================================================================================

-- gen_random_uuid() is built into PostgreSQL 13+ (no extension needed)

-- ---------- staff & roles ----------------------------------------------------------
create table if not exists public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  role       text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Role of the signed-in user ('' when not staff). SECURITY DEFINER so policies can call it
-- without recursion; it only ever reveals the caller's own role.
create or replace function public.staff_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.staff where user_id = auth.uid() and active), '');
$$;
create or replace function public.is_staff()  returns boolean language sql stable as $$ select public.staff_role() <> '' $$;
create or replace function public.can_edit()  returns boolean language sql stable as $$ select public.staff_role() in ('admin', 'editor') $$;
create or replace function public.is_admin()  returns boolean language sql stable as $$ select public.staff_role() = 'admin' $$;

-- ---------- maids --------------------------------------------------------------------
create table if not exists public.maids (
  id                     uuid primary key default gen_random_uuid(),
  code                   text not null unique check (code ~ '^[A-Z0-9][A-Z0-9-]{2,29}$'),
  -- identity (private; public name depends on name_consent)
  full_name              text not null default '',          -- reading order, e.g. "Maria Santos Dela Cruz"
  first_name             text not null default '',          -- given name used for "first" consent
  display_name_override  text not null default '',          -- optional, e.g. a compound first name
  name_consent           text not null default 'none' check (name_consent in ('full', 'first', 'none')),
  nationality            text not null check (nationality in ('indonesian', 'filipino')),
  age                    int check (age between 21 and 60),
  show_age               boolean not null default false,
  religion               text not null default '',
  show_religion          boolean not null default false,     -- PDPA sensitive data: explicit consent only
  marital_status         text not null default '',
  -- experience & skills
  experience_years       numeric(4,1) check (experience_years between 0 and 40),
  overseas_experience    boolean not null default false,
  skills                 jsonb not null default '{"childcare":"none","newborn":"none","elderlyCare":"none","cooking":"none","housekeeping":"none","petCare":"none"}'::jsonb,
  languages              jsonb not null default '[]'::jsonb,    -- [{language, level?}]
  employment_history     jsonb not null default '[]'::jsonb,    -- [{country, duration, duties, duties_ms?}]
  summary_en             text not null default '',
  summary_ms             text not null default '',
  interview_availability_en text not null default '',
  interview_availability_ms text not null default '',
  -- availability
  status                 text not null default 'available'
                         check (status in ('available', 'interview-pending', 'reserved', 'processing', 'placed', 'unavailable', 'withdrawn')),
  status_updated_at      timestamptz not null default now(),
  status_set_by          text not null default '',          -- initials / name; '' = not set → "to be confirmed"
  status_confirmed       boolean not null default false,     -- checked with candidate / supplier
  -- publication & consent
  consent_recorded       boolean not null default false,
  consent_date           date,
  photo_consent          boolean not null default false,
  approved_by            text not null default '',
  published              boolean not null default false,
  featured               boolean not null default false,
  -- files (paths inside storage buckets)
  photo_path             text not null default '',          -- maid-private/<code>.webp
  public_photo_path      text not null default '',          -- maid-public/<code>.webp (only while published + photo consent)
  biodata_pdf_path       text not null default '',          -- maid-private/pdfs/<code>.pdf (never public)
  -- internal
  source_file            text not null default '',
  internal_notes         text not null default '',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  updated_by             uuid,
  constraint skills_shape check (
    skills ?& array['childcare','newborn','elderlyCare','cooking','housekeeping','petCare']
  ),
  constraint publish_requires_consent check (
    not published or (consent_recorded and consent_date is not null and length(trim(approved_by)) > 0)
  ),
  constraint public_photo_requires_consent check (
    public_photo_path = '' or (published and photo_consent)
  )
);
create index if not exists maids_status_idx on public.maids (status);
create index if not exists maids_nat_idx on public.maids (nationality);

-- keep updated_at / updated_by / status_updated_at current
create or replace function public.maids_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'UPDATE' and (new.status is distinct from old.status or new.status_confirmed is distinct from old.status_confirmed) then
    new.status_updated_at := now();
  end if;
  new.code := upper(trim(new.code));
  return new;
end $$;
drop trigger if exists maids_touch on public.maids;
create trigger maids_touch before insert or update on public.maids for each row execute function public.maids_touch();

-- ---------- history (written only by trigger) ----------------------------------------
create table if not exists public.maid_history (
  id          bigint generated always as identity primary key,
  maid_id     uuid,
  code        text not null,
  action      text not null check (action in ('insert', 'update', 'delete')),
  changes     jsonb not null default '{}'::jsonb,              -- {field: {from, to}}
  changed_by  uuid,
  changed_by_email text not null default '',
  changed_at  timestamptz not null default now()
);
create index if not exists maid_history_maid_idx on public.maid_history (maid_id, changed_at desc);

create or replace function public.maids_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  diff jsonb := '{}'::jsonb; k text; o jsonb; n jsonb; who text;
begin
  select email into who from public.staff where user_id = auth.uid();
  if tg_op = 'UPDATE' then
    o := to_jsonb(old); n := to_jsonb(new);
    for k in select jsonb_object_keys(n) loop
      if k not in ('updated_at', 'updated_by') and (o -> k) is distinct from (n -> k) then
        diff := diff || jsonb_build_object(k, jsonb_build_object('from', o -> k, 'to', n -> k));
      end if;
    end loop;
    if diff = '{}'::jsonb then return new; end if;
    insert into public.maid_history (maid_id, code, action, changes, changed_by, changed_by_email)
    values (new.id, new.code, 'update', diff, auth.uid(), coalesce(who, ''));
    return new;
  elsif tg_op = 'INSERT' then
    insert into public.maid_history (maid_id, code, action, changes, changed_by, changed_by_email)
    values (new.id, new.code, 'insert', jsonb_build_object('status', jsonb_build_object('to', new.status)), auth.uid(), coalesce(who, ''));
    return new;
  else
    insert into public.maid_history (maid_id, code, action, changes, changed_by, changed_by_email)
    values (old.id, old.code, 'delete', to_jsonb(old), auth.uid(), coalesce(who, ''));
    return old;
  end if;
end $$;
drop trigger if exists maids_log on public.maids;
create trigger maids_log after insert or update or delete on public.maids for each row execute function public.maids_log();

-- ---------- Row Level Security --------------------------------------------------------
alter table public.staff        enable row level security;
alter table public.maids        enable row level security;
alter table public.maid_history enable row level security;
-- (not FORCE: the table owner — used only by the SECURITY DEFINER functions above — must bypass RLS)

revoke all on public.staff, public.maids, public.maid_history from anon;
grant select, insert, update, delete on public.maids to authenticated;
grant select on public.maid_history to authenticated;
grant select, insert, update, delete on public.staff to authenticated;

drop policy if exists staff_read on public.staff;
create policy staff_read on public.staff for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists staff_admin on public.staff;
create policy staff_admin on public.staff for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists maids_read on public.maids;
create policy maids_read on public.maids for select to authenticated using (public.is_staff());
drop policy if exists maids_insert on public.maids;
create policy maids_insert on public.maids for insert to authenticated with check (public.can_edit());
drop policy if exists maids_update on public.maids;
create policy maids_update on public.maids for update to authenticated using (public.can_edit()) with check (public.can_edit());
drop policy if exists maids_delete on public.maids;
create policy maids_delete on public.maids for delete to authenticated using (public.is_admin());

drop policy if exists history_read on public.maid_history;
create policy history_read on public.maid_history for select to authenticated using (public.is_staff());
-- no insert/update/delete policy on history: only the SECURITY DEFINER trigger writes to it

-- ---------- public read functions (the ONLY thing website visitors can call) ----------
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
         m.status, m.status_updated_at, (m.status_set_by <> ''), m.featured,
         case when m.photo_consent then nullif(m.public_photo_path, '') end
  from public.maids m
  where m.published and m.consent_recorded and m.consent_date is not null
    and m.status not in ('placed', 'unavailable', 'withdrawn');
$$;

-- Lightweight live availability for the static website (code + status only)
create or replace function public.public_maid_status()
returns table (code text, status text, status_updated_at timestamptz, status_recorded boolean)
language sql stable security definer set search_path = public as $$
  select m.code, m.status, m.status_updated_at, (m.status_set_by <> '')
  from public.maids m
  where m.published and m.consent_recorded and m.consent_date is not null;
$$;

revoke all on function public.public_maids(), public.public_maid_status() from public;
grant execute on function public.public_maids(), public.public_maid_status() to anon, authenticated;
revoke all on function public.staff_role(), public.is_staff(), public.can_edit(), public.is_admin() from anon;
grant execute on function public.staff_role(), public.is_staff(), public.can_edit(), public.is_admin() to authenticated;
