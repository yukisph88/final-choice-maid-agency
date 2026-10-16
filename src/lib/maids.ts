import { getCollection, type CollectionEntry } from 'astro:content';
import { t } from '../i18n/ui';
import { RESERVED_PROFILE_SLUGS, type Lang } from '../i18n/routes';
import { DB_SOURCE, fetchPublicMaids, publicPhotoUrl, type PublicMaidRow } from './db';

// One shared record per candidate. Both language versions read exactly the same data
// (code, status, photo, skills), so English and Bahasa Melayu pages cannot disagree.
export type Maid = CollectionEntry<'maids'>['data'] & { slug: string; summary: string; demo: boolean };

export const DEMO = import.meta.env.PUBLIC_DEMO_CANDIDATES === 'true';
/** Local, private review of unpublished drafts (never deployed). Consent is not required in this mode. */
export const REVIEW = import.meta.env.PUBLIC_REVIEW_MODE === 'true';

/** Statuses that are never shown publicly, even if a record is still marked published. */
export const HIDDEN_STATUSES: Maid['status'][] = ['placed', 'unavailable', 'withdrawn'];

/**
 * Candidates that may appear publicly: published, consent recorded, and an active status
 * (available, interview pending, reserved or processing). Everything else is excluded from
 * pages, listings and the sitemap automatically.
 */
let dbCache: Promise<Maid[]> | undefined;
export async function getPublicMaids(): Promise<Maid[]> {
  // Database source (PUBLIC_MAIDS_SOURCE=supabase): approved profiles come from Supabase public_maids(),
  // which already applies consent, name/age/religion/photo permissions and hides placed/unavailable/withdrawn.
  const list = DB_SOURCE && !DEMO && !REVIEW
    ? await (dbCache ??= fetchPublicMaids().then((rows) => rows.filter((r) => !RESERVED_PROFILE_SLUGS.includes(r.code.toLowerCase())).map(fromDb)))
    : (DEMO ? await getCollection('demoMaids') : await getCollection('maids'))
        .map((e) => ({ ...e.data, slug: e.data.code.toLowerCase(), summary: (e.body ?? '').trim(), demo: DEMO || REVIEW }));
  return list
    .filter((m) => (REVIEW || (m.published && m.publication.consentRecorded)) && !HIDDEN_STATUSES.includes(m.status))
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || +b.statusUpdated - +a.statusUpdated);
}

function fromDb(r: PublicMaidRow): Maid {
  const opt = <T,>(v: T | null | undefined) => (v === null || v === '' ? undefined : v ?? undefined);
  return {
    code: r.code, slug: r.code.toLowerCase(), demo: false,
    displayName: opt(r.display_name), nationality: r.nationality, age: opt(r.age), religion: opt(r.religion), maritalStatus: opt(r.marital_status),
    experienceYears: r.experience_years === null ? undefined : Number(r.experience_years), overseasExperience: r.overseas_experience,
    skills: r.skills as Maid['skills'], languages: r.languages as Maid['languages'], employmentHistory: r.employment_history,
    status: r.status as Maid['status'], statusUpdated: new Date(r.status_updated_at), statusRecorded: r.status_recorded, statusConfirmed: r.status_recorded, // database: status_recorded = set and confirmed by staff
    interviewAvailability: opt(r.interview_availability_en), interviewAvailability_ms: opt(r.interview_availability_ms),
    summary: r.summary_en, summary_ms: opt(r.summary_ms), photo: r.photo_path ? publicPhotoUrl(r.photo_path) : undefined,
    featured: r.featured, published: true,
    publication: { consentRecorded: true, consentDate: new Date(r.status_updated_at), photoConsent: Boolean(r.photo_path), showAge: r.age !== null, showReligion: r.religion !== null, approvedBy: 'DB' },
  };
}

/** Status shown to visitors: the status set by staff, or "to be confirmed" when no status has been recorded. */
export type ShownStatus = Maid['status'] | 'unconfirmed';
// Only a status that staff have CONFIRMED (with the candidate or supplier) is shown as a real status.
// An initial status that nobody has verified yet is shown as "Availability to be confirmed".
export const shownStatus = (m: Maid): ShownStatus => (m.statusConfirmed ? m.status : 'unconfirmed');

function statusRank(s: Maid['status']) {
  return ['available', 'interview-pending', 'reserved', 'processing', 'unavailable', 'placed', 'withdrawn'].indexOf(s);
}

export function experiencedSkills(m: Maid, lang: Lang): string[] {
  const L = t(lang).skill;
  return (Object.keys(m.skills) as (keyof Maid['skills'])[])
    // Cards and filters show only skills marked "experienced" (backed by work history); full levels are on the profile.
    .filter((k) => m.skills[k] === 'experienced')
    .map((k) => L[k]);
}

/** Common language names in candidate records, translated for the BM pages. Unknown names are shown as entered. */
const LANGUAGE_NAMES_MS: Record<string, string> = {
  English: 'Bahasa Inggeris', 'Bahasa Indonesia': 'Bahasa Indonesia', 'Bahasa Malaysia': 'Bahasa Melayu', 'Bahasa Melayu': 'Bahasa Melayu',
  Malay: 'Bahasa Melayu', Mandarin: 'Bahasa Mandarin', Cantonese: 'Kantonis', Hokkien: 'Hokkien', Tagalog: 'Tagalog', Filipino: 'Filipino',
  Javanese: 'Bahasa Jawa', Tamil: 'Bahasa Tamil', Arabic: 'Bahasa Arab',
};
const COUNTRY_NAMES_MS: Record<string, string> = {
  Malaysia: 'Malaysia', Singapore: 'Singapura', 'Hong Kong': 'Hong Kong', Taiwan: 'Taiwan', 'Saudi Arabia': 'Arab Saudi',
  'United Arab Emirates': 'Emiriah Arab Bersatu', Kuwait: 'Kuwait', Qatar: 'Qatar', Indonesia: 'Indonesia', Philippines: 'Filipina', Brunei: 'Brunei',
};
export const languageName = (name: string, lang: Lang) => (lang === 'ms' ? LANGUAGE_NAMES_MS[name] ?? name : name);
export const countryName = (name: string, lang: Lang) => (lang === 'ms' ? COUNTRY_NAMES_MS[name] ?? name : name);
