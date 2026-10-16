-- Final Choice — the website must show a status only when staff have CONFIRMED it.
-- Run this once in Supabase → SQL Editor (it replaces the two public read functions; it deletes nothing and
-- changes no table). Output column "status_recorded" now means "status confirmed by staff" (name kept for compatibility).
-- A status that nobody has verified (for example management's initial "Available") is shown on the website as
-- "Availability to be confirmed". Safe to run more than once.

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
         m.status, m.status_updated_at, m.status_confirmed, m.featured,
         case when m.photo_consent then nullif(m.public_photo_path, '') end
  from public.maids m
  where m.published and m.consent_recorded and m.consent_date is not null
    and m.status not in ('placed', 'unavailable', 'withdrawn');
$$;

-- Lightweight live availability for the static website (code + status only)
create or replace function public.public_maid_status()
returns table (code text, status text, status_updated_at timestamptz, status_recorded boolean)
language sql stable security definer set search_path = public as $$
  select m.code, m.status, m.status_updated_at, m.status_confirmed
  from public.maids m
  where m.published and m.consent_recorded and m.consent_date is not null;
$$;

revoke all on function public.public_maids(), public.public_maid_status() from public;
grant execute on function public.public_maids(), public.public_maid_status() to anon, authenticated;
